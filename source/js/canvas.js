var controls, scene, renderer, canvas1, loader, mouse, raycaster,
    c_height, c_width,
    Sun, lights,
    emptyMaterials, transparentMaterial, northMarkMaterial,
    outlines, setupGrid, wireframeMaterial,
    Transformer;

var display_scene, display_area, display_base;
var camera, cameraPers, cameraOrtho, isOrtho;
var framespersecond = 0;
var display_mode = false;
var cubes = new THREE.Group();
var objects = []
var doRender = false;
var three_grid = new THREE.Object3D();
var rot_origin = new THREE.Object3D();
var status_bar_height = 25


function initCanvas() {
    isOrtho = false;
    cameraPers = new THREE.PerspectiveCamera(45, 16 / 9, 1, 3000)
    cameraOrtho = new THREE.OrthographicCamera(-600,  600, -400, 400, 1, 100)
    cameraOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'y'}]
    cameraOrtho.axis = null
    cameraPers.position.set(-20, 20, -20)

    wireframeMaterial = new THREE.LineBasicMaterial({color: 0x74c2ff, linewidth: 1})
    
    controls = new THREE.OrbitControls(cameraPers, canvas1);
    controls.minDistance = 1;
    controls.maxDistance = 320;
    controls.target.set(0,-3,0);
    controls.enableKeys = false;

    //Keybinds
    if (keybinds.canvas_rotate.code <= 3) {
        controls.mouseButtons.ORBIT = keybinds.canvas_rotate.code-1
    }
    if (keybinds.canvas_drag.code <= 3) {
        controls.mouseButtons.PAN = (keybinds.canvas_drag.code-1)
    }
    controls.mouseButtons.ZOOM = undefined;

    
    //Objects
    scene = new THREE.Scene();
    display_scene = new THREE.Scene();
    display_area = new THREE.Object3D();
    display_base = new THREE.Object3D();
    display_scene.add(display_area)
    display_area.add(display_base)
    display_base.add(scene)
    scene.position['x'] = -8
    scene.position['y'] = -8
    scene.position['z'] = -8

    loader = new THREE.TextureLoader()
    
    renderer = new THREE.WebGLRenderer({
        canvas: canvas1,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setClearColor( 0x000000, 0 )
    renderer.setSize(500, 400);

    outlines = new THREE.Object3D();
    outlines.name = 'outline_group'
    scene.add(outlines)

    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2();
    canvas1.addEventListener('mousedown', canvasClick, false)
    canvas1.addEventListener('dblclick', toggleTools, false)
    canvas1.addEventListener('touchstart', onDocumentTouchStart, false)

    //TransformControls
    Transformer = new THREE.TransformControls(cameraPers, canvas1)
    Transformer.setSize(0.5)
    Transformer.setTranslationSnap(canvas_grid)
    scene.add(Transformer)

    enterScene(true)

    //Light
    Sun = new THREE.AmbientLight( 0xffffff );
    scene.add(Sun);

    lights = new THREE.Object3D()
    
    var light_top = new THREE.DirectionalLight( 0x777777 );
    light_top.position.set(8, 100, 8)
    lights.add(light_top);

    var light_west = new THREE.DirectionalLight( 0x222222 );
    light_west.position.set(-100, 8, 8)
    lights.add(light_west);

    var light_east = new THREE.DirectionalLight( 0x222222 );
    light_east.position.set(100, 8, 8)
    lights.add(light_east);

    var light_north = new THREE.DirectionalLight( 0x444444 );
    light_north.position.set(8, 8, -100)
    lights.add(light_north);

    var light_south = new THREE.DirectionalLight( 0x444444 );
    light_south.position.set(8, 8, 100)
    lights.add(light_south);

    setShading()

    //emptyMaterial

    var img = new Image()
    img.src = 'assets/missing.png'
    var tex = new THREE.Texture(img)
    img.tex = tex;
    img.tex.magFilter = THREE.NearestFilter
    img.tex.minFilter = THREE.NearestFilter
    img.onload = function() {
        this.tex.needsUpdate = true;
    }
    emptyMaterials = []
    var randomColorArray = [
        "#A2EBFF",//Light Blue
        "#FFF899",//Yellow
        "#E8BD7B", //Orange
        "#FFA7A4",  //Red
        "#C5A6E8",//Purple
        "#7BD4FF",   //Blue
        "#7BFFA3",//Green
        "#BDFFA6" //Lime
    ]
    randomColorArray.forEach(function(s, i) {
        var thismaterial = new THREE.MeshLambertMaterial({color: 0xffffff, map: tex})

        thismaterial.color.set(s)
        emptyMaterials.push(thismaterial)
    })
    
    //transparentMaterial
    transparentMaterial = new THREE.MeshBasicMaterial({visible:false});

    var img = new Image();
    img.src = 'assets/north.png';
    var tex = new THREE.Texture(img);
    img.tex = tex;
    img.tex.magFilter = THREE.NearestFilter;
    img.tex.minFilter = THREE.NearestFilter;
    img.onload = function() {
        this.tex.needsUpdate = true;
    }
    //northMarkMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color(parseInt(grid_color, 16)), map: tex, transparent: true})
    northMarkMaterial = new THREE.MeshBasicMaterial({map: tex, transparent: true})
    
    setScreenRatio()
}

$(window).resize(function () {
    setScreenRatio()
})
function setScreenRatio() {
    c_height = $(window).height() - 31 - (settings.status_bar.value === true ? 32 : 0);
    c_width = $('#preview').width();
    if (settings.status_bar.value) {

    }

    if (!cameraPers) return;

    var header_width = $('header').width()
    var x = ( header_width - 964 - ($('header .tool:not(.nslide_tool)').length * 42)) / 6
    $('header div.nslide_tool, header div.nslide_tool > div.nslide').css('width', (42 + limitNumber(x, 0, 37)) + 'px')

    if (isOrtho === false) {

        cameraPers.aspect = c_width / c_height
        cameraPers.updateProjectionMatrix();
        renderer.setSize(c_width, c_height);

    } else {
        cameraOrtho.right = c_width / 80
        cameraOrtho.left = cameraOrtho.right*-1
        cameraOrtho.top = c_height / 80
        cameraOrtho.bottom = cameraOrtho.top*-1

        cameraOrtho.updateProjectionMatrix();

        renderer.setSize( c_width, c_height );

        renderer.setSize(c_width, c_height);
    }

    if (active_scene.background.image !== false) {
        if (isOrtho === false) {
            updateScenePosition()
        } else {
            updateScenePosition(cameraOrtho.zoom)
        }
    }
}

function setShading() {
    scene.remove(lights)
    display_scene.remove(lights)
    Sun.intensity = 1
    if (settings.shading.value === true) {
        Sun.intensity = 0.65
        if (display_mode) {
            display_scene.add(lights)
        } else {
            scene.add(lights)
        }
    }
}

function setCameraType(type, angle) {
    if (type === 'ortho') {
        isOrtho = true;
        setScreenRatio()
        controls.object = cameraOrtho;
        Transformer.camera = cameraOrtho;
        controls.enableRotate = false;
        controls.target.set(0, 0, 0);
        cameraOrtho.position.set(0,10,0)

        //Angle
        if (angle === undefined) return;
        var dist = 32
        switch (angle) {
            case 0:
            cameraOrtho.axis = 'y'
            cameraOrtho.position.set(0,dist,0)
            cameraOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: false, a: 'z'}]
            break;
            case 1:
            cameraOrtho.axis = 'y'
            cameraOrtho.position.set(0,-dist,0)
            cameraOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'z'}]
            break;
            case 2:
            cameraOrtho.axis = 'z'
            cameraOrtho.position.set(0,0,dist)
            cameraOrtho.backgroundHandle = [{n: false, a: 'x'}, {n: true, a: 'y'}]
            break;
            case 3:
            cameraOrtho.axis = 'z'
            cameraOrtho.position.set(0,0,-dist)
            cameraOrtho.backgroundHandle = [{n: true, a: 'x'}, {n: true, a: 'y'}]
            break;
            case 4:
            cameraOrtho.axis = 'x'
            cameraOrtho.position.set(dist,0,0)
            cameraOrtho.backgroundHandle = [{n: true, a: 'z'}, {n: true, a: 'y'}]
            break;
            case 5:
            cameraOrtho.axis = 'x'
            cameraOrtho.position.set(-dist,0,0)
            cameraOrtho.backgroundHandle = [{n: false, a: 'z'}, {n: true, a: 'y'}]
            break;
        }
        enterScene('ortho'+angle)
    } else {
        isOrtho = false;
        cameraOrtho.axis = null
        setScreenRatio()
        controls.object = cameraPers;
        Transformer.camera = cameraPers;
        controls.enableRotate = true;
        enterScene('normal')
    }
    Transformer.update();
    Transformer.updateVisibleAxes();
    controls.updateSceneScale();
}

function resetCamera() {
    controls.target.set(0, -3, 0);
    cameraPers.position.set(-20, 20, -20)
    setCameraType('pers')
}

function getFacingDirection() {
    var vec = controls.object.getWorldDirection().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).ceil()
    switch (vec.x+'_'+vec.z) {
        case '1_1':
            return 'south'
            break;
        case '0_0':
            return 'north'
            break;
        case '1_0':
            return 'east'
            break;
        case '0_1':
            return 'west'
            break;
    }
}
function getFacingHeight() {
    var y = controls.object.getWorldDirection().y
    if (y > 0.5) {
        return 'up'
    } else if (y < -0.5) {
        return 'down';
    } else {
        return 'middle'
    }
}

function buildGrid() {
    three_grid.children.length = 0;
    if (display_mode === true && settings.display_grid.value === false) return;

    three_grid.name = 'grid_group'
    var size, step;
    var grid_color = new THREE.Color(parseInt('0x'+app_colors.grid.hex.replace('#', ''), 16))
    var line_material = new THREE.LineBasicMaterial({color: grid_color});
    line_material.linewidth = 6;
    var material;

    northMarkMaterial.color = grid_color


    if (settings.full_grid.value === true) {
        size = 24
        step = canvas_grid;

        var geometry = new THREE.Geometry();
        
        for ( var i = - size; i <= size; i += step) {
            geometry.vertices.push(new THREE.Vector3( -size, 0, i))
            geometry.vertices.push(new THREE.Vector3( size, 0, i))
            geometry.vertices.push(new THREE.Vector3(i, 0, -size))
            geometry.vertices.push(new THREE.Vector3(i, 0, size))
        }
        var line = new THREE.Line( geometry, line_material, THREE.LinePieces);
        line.position.set(8,0,8)
        three_grid.add(line)
        line.name = 'grid'


        //Axis Helpers
        geometry = new THREE.Geometry();
        material = new THREE.LineBasicMaterial({color: '#EE4040'});
        geometry.vertices.push(new THREE.Vector3( -16, 0, -16.005))
        geometry.vertices.push(new THREE.Vector3( 32, 0, -16.005))
        x_axis = new THREE.Line( geometry, material, THREE.LinePieces);
        three_grid.add(x_axis)

        geometry = new THREE.Geometry();
        material = new THREE.LineBasicMaterial({color: '#547CEA'});
        geometry.vertices.push(new THREE.Vector3( -16.005, 0, -16))
        geometry.vertices.push(new THREE.Vector3( -16.005, 0, 32))
        z_axis = new THREE.Line( geometry, material, THREE.LinePieces);
        three_grid.add(z_axis)

        //North
        geometry = new THREE.PlaneGeometry(5, 5)
        var north_mark = new THREE.Mesh(geometry, northMarkMaterial)
        north_mark.position.set(8,0,-19)
        north_mark.rotation.x = Math.PI / -2
        three_grid.add(north_mark)

    } else {
        if (settings.large_grid.value === true) {
            var geometry_big = new THREE.Geometry();
            size = 24
            step = 16;
            
            for ( var i = - size; i <= size; i += step) {
                geometry_big.vertices.push(new THREE.Vector3( -size, 0, i))
                geometry_big.vertices.push(new THREE.Vector3( size, 0, i))
                geometry_big.vertices.push(new THREE.Vector3(i, 0, -size))
                geometry_big.vertices.push(new THREE.Vector3(i, 0, size))
            }

            var line_big = new THREE.Line( geometry_big, line_material, THREE.LinePieces);
            line_big.position.set(8,0,8)
            line_big.name = 'grid'
            three_grid.add(line_big)

        }


        if (settings.base_grid.value === true) {
            size = 8
            step = canvas_grid;

            var geometry = new THREE.Geometry();
            
             for ( var i = - size; i <= size; i += step) {
                 geometry.vertices.push(new THREE.Vector3( -size, 0, i))
                 geometry.vertices.push(new THREE.Vector3( size, 0, i))
                 geometry.vertices.push(new THREE.Vector3(i, 0, -size))
                 geometry.vertices.push(new THREE.Vector3(i, 0, size))
             }
            var line = new THREE.Line( geometry, line_material, THREE.LinePieces);
            line.position.set(8,0,8)
            three_grid.add(line)
            
            line.name = 'grid'

            //Axis Helpers
            geometry = new THREE.Geometry();
            material = new THREE.LineBasicMaterial({color: '#EE4040'});
            geometry.vertices.push(new THREE.Vector3( 0, 0, -0.005))
            geometry.vertices.push(new THREE.Vector3( 16, 0, -0.005))
            x_axis = new THREE.Line( geometry, material, THREE.LinePieces);
            three_grid.add(x_axis)

            geometry = new THREE.Geometry();
            material = new THREE.LineBasicMaterial({color: '#547CEA'});
            geometry.vertices.push(new THREE.Vector3( -0.005, 0, 0))
            geometry.vertices.push(new THREE.Vector3( -0.005, 0, 16))
            z_axis = new THREE.Line( geometry, material, THREE.LinePieces);
            three_grid.add(z_axis)

            //North
            geometry = new THREE.PlaneGeometry(2.4, 2.4)
            var north_mark = new THREE.Mesh(geometry, northMarkMaterial)
            north_mark.position.set(8,0,-1.5)
            north_mark.rotation.x = Math.PI / -2
            three_grid.add(north_mark)
        }
    }
    if (settings.large_box.value === true) {
        var geometry_box = new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(48, 48, 48));

        var large_box = new THREE.LineSegments( geometry_box, line_material);
        large_box.position.set(8,8,8)
        large_box.name = 'peter'
        three_grid.add(large_box)
    }
    scene.add(three_grid)

    //Origin

    if (setupGrid !== true) {
        var helper1 = new THREE.AxisHelper(2)
        var helper2 = new THREE.AxisHelper(2)
        helper1.rotation.x = Math.PI / 1

        helper2.rotation.x = Math.PI / -1
        helper2.rotation.y = Math.PI / 1
        helper2.scale.y = -1

        rot_origin.add(helper1)
        rot_origin.add(helper2)

        setupGrid = true;
    }
}

function buildOutline(id) {
    if (elements[id].display.visibility == false) return;
    var object = elements[id].display.mesh
    if (object === undefined) return;
    var geo = new THREE.EdgesGeometry(object.geometry);

    var outline_color = '0x'+app_colors.accent.hex.replace('#', '')
    var mat = new THREE.LineBasicMaterial({color: parseInt(outline_color), linewidth: 50})
    var wireframe = new THREE.LineSegments(geo, mat)
    wireframe.name = id+'_outline'
    wireframe.position.set(object.position.x, object.position.y, object.position.z)

    var obj = elements[id]
    if (obj.rotation) {
        wireframe.position.set(obj.rotation.origin[0], obj.rotation.origin[1], obj.rotation.origin[2])
        if (obj.rotation.angle !== 0) {
            wireframe.rotation[obj.rotation.axis] = Math.PI / (180 /obj.rotation.angle) 
        }
        if (obj.rotation.rescale === true) {
            
            var rescale = getRescalingFactor(obj.rotation.angle);
            wireframe.scale.set(rescale, rescale, rescale)
            wireframe.scale[obj.rotation.axis] = 1
        }
    }
    outlines.add(wireframe)
}


function setOriginHelper(obj) {
    if (obj.origin === undefined) return;
    rot_origin.position.x = obj.origin[0]
    rot_origin.position.y = obj.origin[1]
    rot_origin.position.z = obj.origin[2]

    rot_origin.rotation.x = 0
    rot_origin.rotation.y = 0
    rot_origin.rotation.z = 0
    rot_origin.rotation[obj.axis] = Math.PI / (180 /obj.angle)
    scene.add(rot_origin)
}

function animate() {
    requestAnimationFrame( animate );
    controls.update();
    framespersecond++;
    if (display_mode === true) {
        if (isOrtho === true) {
            renderer.render(display_scene, cameraOrtho)
        } else {
            renderer.render(display_scene, cameraPers)
        }
        if (ground_animation === true) {
            groundAnimation()
        }
    } else {
        if (isOrtho === true) {
            renderer.render(scene, cameraOrtho)
        } else {
            renderer.render(scene, cameraPers)
        }
    }
}

function onDocumentTouchStart( event ) {
    event.preventDefault();
    
    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
    canvasClick( event )
}

var drag_top, drag_left;

function canvasClick( event ) {
    $(':focus').blur()
    if (Transformer.hoverAxis !== null || display_mode === true || event.button !== 0) return;

    event.preventDefault()

    var canvas_offset = $('#preview').offset()

    mouse.x = ((event.clientX - canvas_offset.left) / c_width) * 2 - 1;
    mouse.y = - ((event.clientY - canvas_offset.top) / c_height) * 2 + 1;

    if (isOrtho === true) {
        raycaster.setFromCamera( mouse, cameraOrtho );
    } else {
        raycaster.setFromCamera( mouse, cameraPers );
    }


    objects = []
    scene.children.forEach(function(s) {
        if (s.isElement === true) {
            objects.push(s)
        }
    })

    var intersects = raycaster.intersectObjects( objects );
    if (intersects.length > 0) {
        controls.hasMoved = true
        var selectedFace = 'north'
        switch(Math.floor( intersects[0].faceIndex / 2 )) {
            case 5:
            selectedFace = 'north'
            break;
            case 0:
            selectedFace = 'east'
            break;
            case 4:
            selectedFace = 'south'
            break;
            case 1:
            selectedFace = 'west'
            break;
            case 2:
            selectedFace = 'up'
            break;
            case 3:
            selectedFace = 'down'
            break;
        }
        main_uv.setFace(selectedFace)
        var obj = TreeElements.findRecursive('uuid', intersects[0].object.name)
        event.cube = obj
        Blockbench.dispatchEvent( 'canvas_select', event )
        addToSelection(elements.indexOf(obj), event)

        if (Prop.tool === 'brush' && event.shiftKey === false) {
            if (brush_template == 'select') {
                brush_template = TreeElements.findRecursive('uuid', intersects[0].object.name)
                $(canvas1).css('cursor', 'url(assets/brush.png), auto')
            } else {
                paint()
            }
        }
        return true;
    } else {
        return false;
    }
}

function toggleTools() {
    if (Prop.tool === 'translate') {
        setTool('scale')
    } else /*if (Prop.tool === 'scale')*/ {
        setTool('translate')
    }
}

function centerTransformer(offset) {
    if (selected.length === 0) return;

    var center = [0, 0, 0]
    var i = 0;
    selected.forEach(function(s) {
        var obj = elements[s]
        i = 0;
        while (i < 3) {
            center[i] += obj.from[i]
            center[i] += obj.to[i]
            i++;
        }
    })
    i = 0;
    while (i < 3) {
        center[i] = center[i] / (selected.length * 2)
        i++;
    }
    var obj = elements[selected[0]]

    var vec = new THREE.Vector3(center[0], center[1], center[2])
    if (selected.length === 1 && obj.rotation !== undefined) {
        vec.x -= obj.rotation.origin[0]
        vec.y -= obj.rotation.origin[1]
        vec.z -= obj.rotation.origin[2]
        vec.applyEuler(obj.display.mesh.rotation)
        vec.x += obj.rotation.origin[0]
        vec.y += obj.rotation.origin[1]
        vec.z += obj.rotation.origin[2]
    }
    Transformer.position.copy(vec)
    Transformer.rotation.set(0, 0, 0)
    if (obj.rotation !== undefined && movementAxis === true) {
        Transformer.rotation[obj.rotation.axis] = Math.PI / (180 / obj.rotation.angle)
    }
    if (offset !== undefined) {
        Transformer.position.add(offset)
    }
}

function getRescalingFactor(angle) {
    switch (Math.abs(angle)) {
        case 0:
            return 1.4142
            break;
        case 22.5:
            return 1.127
            break;
        case 67.5:
            return 1.127
            break;
        case 45:
            return 1.4142
            break;
        default:
            return 1;
            break;
    }
}

function getUVArray(side, frame, stretch) {
    if (stretch === undefined) {
        stretch = -1
    } else {
        stretch = stretch*(-1)
    }
    var arr = [
        new THREE.Vector2(side.uv[0]/16, (side.uv[1]/16)/stretch+1),  //0,1
        new THREE.Vector2(side.uv[0]/16, (side.uv[3]/16)/stretch+1),  //0,0
        new THREE.Vector2(side.uv[2]/16, (side.uv[3]/16)/stretch+1),   //1,0
        new THREE.Vector2(side.uv[2]/16, (side.uv[1]/16)/stretch+1)  //1,1
    ]
    if (frame > 0 && stretch !== -1) {
        //Animate
        var offset = (1/stretch) * frame
        arr[0].y += offset
        arr[1].y += offset
        arr[2].y += offset
        arr[3].y += offset
    }
    var rot = (side.rotation+0)
    while (rot > 0) {
        arr.push(arr.shift())
        rot = rot-90;
    }
    return arr;
}


class CanvasController {
    constructor() {
        this.materials = []
    }
    clear() {
        var objects = []
        scene.children.forEach(function(s) {
            if (s.isElement === true) {
                objects.push(s)
            }
        })
        objects.forEach(function(s) {
            scene.remove(s)
            //delete s
        })
    }
    updateAll() {
        updateNslideValues()
        Canvas.clear()
        elements.forEach(function(s, i) {
            if (s.display.visibility == true) {
                Canvas.addCube(i)
            }
        })
        updateSelection()
    }
    updateSelected() {
        updateNslideValues()
        selected.forEach(function(s) {
            if (elements[s].display.visibility == true) {
                var obj = elements[s].display.mesh
                if (obj !== undefined) {
                    scene.remove(obj)
                }
                Canvas.addCube(s)
            }
        })
        updateSelection()
    }
    updateIndexes() {
        var lut = []
        elements.forEach(function(s, i) {
            var obj = s.display.mesh;
            if (obj !== undefined) {
                obj.name = s.uuid;
                lut.push(obj)
            }
        })
        scene.children.forEach(function(s, i) {
            if (s.isElement === true) {
                if (lut.indexOf(s) === -1) {
                    scene.remove(s)
                }
            }
        })
        updateSelection()
    }
    addCube(index) {
        //This does NOT remove old cubes
        var s = elements[index]

        //Material
        if (Prop.wireframe === false) {
            var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
            Canvas.adaptObjectFaces(mesh, s)
        } else {
            var mesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), wireframeMaterial);
        }

        Canvas.adaptObjectPosition(mesh, s)
        mesh.name = s.uuid;
        mesh.type = 'cube';
        mesh.isElement = true;
        scene.add(mesh)
        s.display.mesh = mesh
        if (Prop.wireframe === false) {
            Canvas.updateUV(index)
        }
    }
    adaptObjectPosition(mesh, obj) {

        if (Prop.wireframe === true) {
            var proxy_box = new THREE.BoxGeometry(1, 1, 1)
            proxy_box.from(obj.from)
            proxy_box.to(obj.to)
            mesh.geometry = new THREE.EdgesGeometry(proxy_box)
            mesh.geometry.computeBoundingSphere()
        } else {
            mesh.geometry.from(obj.from)
            mesh.geometry.to(obj.to)
            mesh.geometry.computeBoundingSphere()
        }
        mesh.scale.set(1, 1, 1)
        mesh.rotation.set(0, 0, 0)

        if (obj.rotation !== undefined) {

            mesh.position.set(obj.rotation.origin[0], obj.rotation.origin[1], obj.rotation.origin[2])
            mesh.geometry.translate(-obj.rotation.origin[0], -obj.rotation.origin[1], -obj.rotation.origin[2])

            mesh.rotation[obj.rotation.axis] = Math.PI / (180 /obj.rotation.angle)

            if (obj.rotation.rescale === true) {

                var rescale = getRescalingFactor(obj.rotation.angle);
                mesh.scale.set(rescale, rescale, rescale)
                mesh.scale[obj.rotation.axis] = 1
            }
        } else {
            mesh.position.set(0, 0, 0)
        }
    }
    updatePositions(leave_selection) {
        updateNslideValues()
        selected.forEach(function(s) {
            if (elements[s].display.visibility == true) {
                Canvas.adaptObjectPosition(elements[s].display.mesh, elements[s])
            }
        })
        if (leave_selection !== true) {
            updateSelection()
        }
    }
    updateVisiblilty() {
        Canvas.updateAll()
        /*
        elements.forEach(function(s) {
            if (s.display.visibility == true) {
                scene.add(s.display.mesh)
            } else {
                scene.remove(s.display.mesh)
            }
        })
        updateSelection()
        */
    }
    adaptObjectFaces(mesh, obj) {
        var materials = []

        for (var face in obj.faces) {
            if (obj.faces.hasOwnProperty(face)) {

                var tex = getTextureById(obj.faces[face].texture)
                if (typeof tex !== 'object') {
                    materials.push(emptyMaterials[ elements.indexOf(obj) % emptyMaterials.length ])
                } else {
                    materials.push(Canvas.materials[tex.uuid])
                }
            }
        }
        mesh.material = new THREE.MultiMaterial(materials)
    }
    updateSelectedFaces() {
        if (Prop.wireframe === true) return;
        selected.forEach(function(s) {
            if (elements[s].display.visibility == true) {
                Canvas.adaptObjectFaces(elements[s].display.mesh, elements[s])
                Canvas.updateUV(s)
            }
        })
    }
    updateAllFaces() {
        if (Prop.wireframe === true) return;
        elements.forEach(function(s, i) {
            if (s.display.visibility == true) {
                Canvas.adaptObjectFaces(s.display.mesh, s, selected.includes(i))
                Canvas.updateUV(i)
            }
        })
    }
    updateUVs() {
        if (Prop.wireframe === true) return;
        selected.forEach(function(s) {
            if (elements[s].display.visibility == true) {
                Canvas.updateUV(s)
            }
        })
    }
    updateAllUVs() {
        if (Prop.wireframe === true) return;
        elements.forEach(function(s, i) {
            if (s.display.visibility == true) {
                Canvas.updateUV(i)
            }
        })
    }
    updateUV(index, animation) {
        if (Prop.wireframe === true) return;
        var obj = elements[index]
        var mesh = obj.display.mesh
        if (mesh === undefined) return;
        mesh.geometry.faceVertexUvs[0] = [];
        
        var obj = obj.faces
        for (var face in obj) {
            if (obj.hasOwnProperty(face)) {
                var fIndex = 0;
                switch(face) {
                    case 'north':   fIndex = 10;   break;
                    case 'east':    fIndex = 0;    break;
                    case 'south':   fIndex = 8;    break;
                    case 'west':    fIndex = 2;    break;
                    case 'up':      fIndex = 4;    break;
                    case 'down':    fIndex = 6;    break;
                }
                var stretch = 1
                var frame = 0
                if (obj[face].texture && obj[face].texture !== '$transparent') {
                    var tex = getTextureById(obj[face].texture)
                    if (typeof tex === 'object' && tex.constructor.name === 'Texture' && tex.frameCount) {
                        stretch = tex.frameCount
                        if (animation === true && tex.currentFrame) {
                            frame = tex.currentFrame
                        }
                    }
                }
                mesh.geometry.faceVertexUvs[0][fIndex] = [
                    getUVArray(obj[face], frame, stretch)[0],
                    getUVArray(obj[face], frame, stretch)[1],
                    getUVArray(obj[face], frame, stretch)[3]
                ];
                mesh.geometry.faceVertexUvs[0][fIndex+1] = [
                    getUVArray(obj[face], frame, stretch)[1],
                    getUVArray(obj[face], frame, stretch)[2],
                    getUVArray(obj[face], frame, stretch)[3]
                ];
            }
        }
        mesh.geometry.elementsNeedUpdate = true;
        return mesh.geometry
    }
}
var Canvas = new CanvasController()