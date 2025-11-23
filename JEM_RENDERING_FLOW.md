# JEM File Rendering Flow Documentation

## Complete Flow: From .jem File to Three.js Canvas

This document provides a comprehensive technical analysis of how Blockbench processes modern OptiFine JEM (JSON Entity Model) files and renders them in the three.js canvas, including the intricacies of the parser and reasons for specific design decisions.

---

## Table of Contents

1. [Overview](#overview)
2. [Modern JEM File Structure](#modern-jem-file-structure)
3. [File Parsing Phase](#file-parsing-phase)
4. [Data Model Construction](#data-model-construction)
5. [Three.js Scene Setup](#threejs-scene-setup)
6. [Mesh Building Pipeline](#mesh-building-pipeline)
7. [Transformation System](#transformation-system)
8. [Rendering Loop](#rendering-loop)
9. [Parser Intricacies and Design Decisions](#parser-intricacies-and-design-decisions)

---

## Overview

The rendering pipeline follows this high-level flow:

```
┌─────────────────────┐
│ .jem File (JSON)    │
│ Modern Format       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Parse Phase                 │
│ (optifine_jem.js:204-370)   │
│ • Read models array         │
│ • Import textures           │
│ • Process bones & boxes     │
└──────┬──────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Blockbench Data Model        │
│ • Group (bone/part)          │
│ • Cube (box)                 │
│ • Texture                    │
└──────┬───────────────────────┘
       │
       ▼
┌───────────────────────────────┐
│ NodePreviewController         │
│ • setup() - Create 3D objects │
│ • updateGeometry() - Shape    │
│ • updateFaces() - Materials   │
│ • updateUV() - Texture coords │
│ • updateTransform() - Position│
└──────┬────────────────────────┘
       │
       ▼
┌────────────────────────────────┐
│ Three.js Scene Graph           │
│ Scene                          │
│ └── Project.model_3d           │
│     └── Bone (THREE.Object3D)  │
│         └── Box (THREE.Mesh)   │
└──────┬─────────────────────────┘
       │
       ▼
┌──────────────────────┐
│ WebGLRenderer        │
│ • 60 FPS loop        │
│ • Camera controls    │
│ • Canvas output      │
└──────────────────────┘
```

---

## Modern JEM File Structure

Modern JEM files use a clean, streamlined structure. Here's an example from a typical entity model:

```json
{
  "textureSize": [64, 64],
  "models": [
    {
      "invertAxis": "xy",
      "part": "head",
      "id": "head",
      "translate": [-1.0, -24.0, 8.0],
      "scale": 1.0,
      "boxes": [
        {
          "textureSize": [64, 64],
          "textureOffset": [0, 0],
          "sizeAdd": 0.0
        },
        {
          "textureSize": [64, 64],
          "textureOffset": [22, 0],
          "sizeAdd": 0.0
        }
      ]
    },
    {
      "invertAxis": "xy",
      "part": "body",
      "id": "body",
      "scale": 1.0,
      "boxes": [
        {
          "textureSize": [64, 64],
          "textureOffset": [18, 4],
          "sizeAdd": 0.0
        }
      ]
    }
  ]
}
```

### Key Structure Elements

**Root Level:**
- `textureSize`: Default texture dimensions `[width, height]` for the entire model
- `models`: Array of bone/part definitions

**Model/Bone Level:**
- `invertAxis`: Always `"xy"` for modern JEM (coordinate system indicator)
- `part`: Bone name (matches Minecraft's entity model part names like "head", "body", "leg1")
- `id`: Unique identifier for the bone
- `translate`: Bone pivot point `[x, y, z]` in Minecraft coordinates
- `scale`: Uniform scale multiplier for the bone (typically 1.0)
- `boxes`: Array of cube/box definitions
- `rotate`: (optional) Bone rotation `[x, y, z]` in degrees
- `submodels`: (optional) Nested child bones

**Box Level:**
- `textureSize`: UV dimensions `[width, height]` for this box's texture (can override bone/model defaults)
- `textureOffset`: UV starting position `[u, v]` for box UV mode
- `sizeAdd`: Inflation value (expands cube in all directions)
- `coordinates`: (optional in modern format) `[x, y, z, width, height, depth]` - when omitted, uses default cube dimensions

### Why This Structure?

The modern JEM format emphasizes **texture-driven geometry** rather than explicit coordinates. This design choice:

1. **Reduces file size** - Box dimensions often match texture UV layouts, so they can be inferred
2. **Matches Minecraft conventions** - Vanilla Minecraft models use box UV with texture offsets
3. **Simplifies editing** - Artists work with UV coordinates, and geometry follows automatically
4. **Maintains compatibility** - Works seamlessly with Minecraft's entity rendering system

---

## File Parsing Phase

**Location:** `/js/io/formats/optifine_jem.js` (lines 204-370)

### Format Detection

The codec uses a smart load filter to identify valid JEM files:

```javascript
load_filter: {
    type: 'json',
    extensions: ['jem'],
    condition(file) {
        return file && file.models != undefined;
    }
}
```

**Why this approach?** The `models` array is the defining characteristic of a modern JEM file. This condition ensures:
- Only valid JEM files are loaded (must have a `models` array)
- Invalid JSON or other .json files are rejected
- Clear contract: if `file.models` exists, it's a JEM file

This simple check is more reliable than complex format detection because the `models` array is always required in JEM files.

### Texture Import System

**Location:** Lines 208-243

Modern JEM files reference textures at three levels: model-level default, bone-level override, and box-level override. The parser handles all three:

```javascript
function importTexture(string, uv) {
    if (typeof string !== 'string') return;
    if (imported_textures[string]) return imported_textures[string];  // Cache hit

    let texture_path = string.replace(/[\\/]/g, osfs);
    let namespace = '';

    // Parse namespace (e.g., "minecraft:textures/entity/cow")
    if (texture_path.includes(':')) {
        [namespace, texture_path] = texture_path.split(':');
    }

    // Resolve path relative to .jem file location
    if (texture_path.match(/^textures/) && path.includes('optifine')) {
        texture_path = path.replace(/[\\/]optifine[\\/].+$/i, osfs+texture_path);
    } else if (path.includes(osfs)) {
        texture_path = path.replace(/[\\/][^\\/]+$/, osfs+texture_path);
    }

    // Auto-append .png extension
    if (!texture_path.match(/\.\w{3,4}$/)) texture_path = texture_path + '.png';

    let texture = new Texture().fromPath(texture_path).add(false);
    if (namespace && !texture.namespace) texture.namespace = namespace;

    imported_textures[string] = texture;
    if (uv instanceof Array) {
        texture.extend({ uv_width: uv[0], uv_height: uv[1] })
    }
    return texture;
}
```

**Key intricacies and why they exist:**

1. **Texture caching** (line 210): The `imported_textures` object prevents duplicate Texture instances. If 20 boxes reference the same texture, only one Texture object is created. This is critical for:
   - Memory efficiency
   - Consistent texture updates (change applies to all boxes)
   - Faster parsing

2. **Namespace resolution** (line 214-216): Minecraft resource packs use namespaces like `minecraft:textures/entity/cow`. The parser:
   - Splits the namespace prefix from the path
   - Resolves to `assets/{namespace}/` directory structure
   - Supports mod namespaces (e.g., `mymod:textures/entity/custom`)

3. **OptiFine path conventions** (line 218-219): OptiFine JEM files can live in `assets/minecraft/optifine/cem/` but reference textures using `textures/entity/...`. The parser detects this pattern and resolves relative to the resource pack root, not the .jem file's directory.

4. **Automatic .png extension** (line 223): Modern JEM files typically omit the `.png` extension. Adding it automatically improves user experience - artists don't need to remember to include it.

5. **Per-texture UV dimensions** (line 236-241): The `uv` parameter (from `textureSize` in JEM) overrides the default UV dimensions. This is essential because:
   - Different boxes in the same model can use different resolution textures
   - High-detail parts (like faces) might use 128x128 while bodies use 64x64
   - The UV coordinates are interpreted relative to these dimensions

---

## Data Model Construction

### Group (Bone) Creation

**Location:** Lines 264-278

When the parser encounters a bone/part in the `models` array, it creates a Blockbench `Group` object:

```javascript
group = new Group({
    name: b.part,              // "head", "body", "leg1", etc.
    origin: b.translate,       // Pivot point from JEM
    rotation: b.rotate,        // Optional rotation in degrees
    mirror_uv: (b.mirrorTexture && b.mirrorTexture.includes('u')),
    cem_animations: b.animations,  // OptiFine CEM animations
    cem_attach: b.attach,      // Can attach to parent
    cem_model: b.model,        // External model reference
    cem_scale: b.scale,        // Scale multiplier
    texture: texture ? texture.uuid : undefined,
})
group.origin.V3_multiply(-1);  // CRITICAL: Coordinate system conversion
group.init().addTo();           // Initialize and add to project
```

**The Critical Coordinate System Conversion** (line 276)

This is one of the most important operations in the parser:

```javascript
group.origin.V3_multiply(-1);  // Multiply all components by -1
```

**Why is this necessary?**

Minecraft uses a **Y-down coordinate system** (positive Y goes down), while Blockbench and three.js use a **Y-up coordinate system** (positive Y goes up). The `translate` array in JEM files contains Y-down coordinates.

For example, a head bone at `[0, -24, 0]` in JEM means:
- X: 0 (centered)
- Y: 24 units down from origin
- Z: 0 (centered)

After multiplying by -1, it becomes `[0, 24, 0]` in Blockbench's Y-up system, which correctly represents "24 units up."

During export (line 52 in the compile function), this is reversed:
```javascript
bone.translate.V3_multiply(-1);  // Convert back to Y-down for JEM
```

This bidirectional conversion ensures JEM files remain compatible with Minecraft while Blockbench uses industry-standard Y-up coordinates.

### Cube (Box) Creation

**Location:** Lines 285-339

For each box in a bone's `boxes` array, the parser creates a Blockbench `Cube` object:

```javascript
var base_cube = new Cube({
    name: box.name || p_group.name,     // Inherit bone name if not specified
    autouv: 0,                           // Disable auto-UV
    uv_offset: box.textureOffset,        // [u, v] starting position
    box_uv: !!box.textureOffset,         // true if using box UV mode
    inflate: box.sizeAdd,                // Expansion factor
    mirror_uv: p_group.mirror_uv         // Inherit mirroring from bone
})
```

**Modern JEM Box UV Mode**

Modern JEM files primarily use **box UV mode** with `textureOffset` and `textureSize`. This mode:
- Automatically lays out all 6 cube faces in a standard pattern
- Matches vanilla Minecraft's box UV template
- Simplifies texture creation (artists draw one template, boxes use it automatically)

The parser detects box UV mode with: `box_uv: !!box.textureOffset`

If `textureOffset` exists, it's box UV. The `!!` converts the array to boolean `true`.

**Handling Optional Coordinates** (lines 298-310):

Modern JEM files often omit the `coordinates` field:

```javascript
if (box.coordinates) {
    base_cube.extend({
        from: [
            box.coordinates[0],
            box.coordinates[1],
            box.coordinates[2]
        ],
        to: [
            box.coordinates[0] + box.coordinates[3],
            box.coordinates[1] + box.coordinates[4],
            box.coordinates[2] + box.coordinates[5]
        ]
    })
}
```

**Why are coordinates optional?**

When `coordinates` is omitted, the Cube uses default dimensions (typically `[0,0,0]` to `[16,16,16]` or based on UV size). This is intentional:
- Reduces JEM file size (no need to repeat common cube dimensions)
- Artists define geometry through texture UV layout
- The box UV system can infer dimensions from `textureOffset` and `textureSize`

**Coordinate Space Conversion for Nested Bones** (lines 332-337):

```javascript
if (p_group && (p_group.parent !== 'root' || model._is_jpm)) {
    for (var i = 0; i < 3; i++) {
        base_cube.from[i] += p_group.origin[i];
        base_cube.to[i] += p_group.origin[i];
    }
}
```

**Why add the parent origin?**

- **JEM format:** Cube coordinates are relative to their parent bone's pivot point
- **Blockbench:** Cubes use absolute world coordinates

The parser converts relative → absolute by adding the parent bone's origin. This ensures cubes appear in the correct position regardless of their bone hierarchy depth.

### Recursive Submodel Processing

**Location:** Lines 341-360

Modern JEM files support nested bone hierarchies using `submodels`. The parser processes these recursively:

```javascript
if (submodel.submodels && submodel.submodels.length) {
    submodel.submodels.forEach(subsub => {
        // Adjust nested bone positions
        if (depth >= 1 && subsub.translate) {
            subsub.translate[0] += p_group.origin[0];
            subsub.translate[1] += p_group.origin[1];
            subsub.translate[2] += p_group.origin[2];
        }

        // Import submodel texture if specified
        let sub_texture = importTexture(subsub.texture, subsub.textureSize);

        // Create nested Group
        let group = new Group({
            name: subsub.id || subsub.comment || `${b.part??'part'}_sub_${subcount}`,
            origin: subsub.translate || (depth >= 1 ? submodel.translate : undefined),
            rotation: subsub.rotate,
            mirror_uv: (subsub.mirrorTexture && subsub.mirrorTexture.includes('u')),
            texture: (sub_texture || texture)?.uuid,
        })
        group.addTo(p_group).init()

        // Recursively process this submodel's contents
        readContent(subsub, group, depth+1, sub_texture || texture)
    })
}
```

**Depth-Based Coordinate Adjustment** (lines 343-347)

This is a subtle but critical detail:

- **Depth 0** (top-level bones like "head", "body"): `translate` values are absolute positions in the model
- **Depth ≥ 1** (submodels/nested bones): `translate` values are relative to the parent bone

The parser adds the parent's origin to nested bones to convert relative → absolute coordinates for Blockbench.

**Example:**
```json
{
  "part": "head",
  "translate": [0, -24, 0],  // Absolute: head is 24 units down
  "submodels": [{
    "id": "hat",
    "translate": [0, -2, 0]  // Relative: 2 units above head pivot
  }]
}
```

After processing, the hat bone has origin `[0, -26, 0]` (sum of parent and relative positions).

**Texture Inheritance Chain** (line 358)

```javascript
texture: (sub_texture || texture)?.uuid
```

This creates a cascading texture system:
1. If the submodel specifies a `texture`, use it
2. Otherwise, use the parent bone's texture
3. Otherwise, use the model's default texture

This allows complex models to have different textures per part while defaulting to a main texture.

---

## Three.js Scene Setup

### Scene Hierarchy

**Location:** `/js/preview/preview.js` (lines 2104-2179), `/js/io/project.js` (lines 76-79, 214)

```
Canvas.scene (THREE.Scene)
├── Lights (ambient + directional)
├── Grid (three_grid)
├── Project.model_3d (THREE.Object3D) ─┐
│   ├── Group bone (THREE.Object3D)    │ Created during parsing
│   │   ├── Cube mesh (THREE.Mesh)     │ One per JEM box
│   │   └── Subgroup (THREE.Object3D)  │ Nested submodels
│   └── Another bone...                │
└── Canvas.outlines ─────────────────────┘ Selection visualizations
```

**Project-scoped 3D hierarchy:**

Each `ModelProject` maintains its own `model_3d` container (line 76-79 in project.js):

```javascript
ProjectData[this.uuid] = {
    model_3d: new THREE.Object3D(),
    nodes_3d: {}  // Maps element UUID → THREE.Mesh/Object3D
}
```

**Why per-project containers?**

Blockbench supports multiple open projects. When switching projects, the old `model_3d` is removed from the scene and the new one is added (lines 214, 328), allowing instant project switching without rebuilding the entire scene.

---

## Mesh Building Pipeline

### Group → THREE.Object3D

**Location:** `/js/outliner/group.js` (lines 609-626)

```javascript
new NodePreviewController(Group, {
    setup(group) {
        let bone = new THREE.Object3D();
        bone.name = group.uuid;
        bone.isGroup = true;
        Project.nodes_3d[group.uuid] = bone;
        bone.rotation.order = Format.euler_order;

        this.dispatchEvent('update_transform', {group});
    }
})
```

**Why THREE.Object3D instead of THREE.Group?**

THREE.Object3D is the minimal container for transformation hierarchy. It has no geometry or material, making it lightweight for bone rigs that can have hundreds of bones.

### Cube → THREE.Mesh

**Location:** `/js/outliner/cube.js` (lines 1106-1136)

```javascript
setup(element) {
    let mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        Canvas.emptyMaterials[0]
    );
    Project.nodes_3d[element.uuid] = mesh;

    // Highlight attribute for selection shader
    mesh.geometry.setAttribute('highlight',
        new THREE.BufferAttribute(new Uint8Array(24).fill(0), 1)
    );

    // Selection outline
    let line = new THREE.Line(geometry, Canvas.outlineMaterial);
    mesh.outline = line;
    mesh.add(line);

    // Initialize all aspects
    this.updateTransform(element);
    this.updateGeometry(element);
    this.updateFaces(element);
    this.updateUV(element);
}
```

**Initial BoxGeometry(1,1,1):**

The initial 1×1×1 cube is a placeholder. The `updateGeometry()` call immediately reshapes it using the custom `setShape()` method. Starting with a valid geometry avoids null checks throughout the codebase.

**Highlight attribute** (line 1116):

This custom buffer attribute stores per-vertex highlight state (0 or 1). The shader uses this to render selection highlights without changing materials, allowing efficient GPU-based highlighting.

**Outline as child mesh:**

The selection outline is added as a child of the cube mesh, so it automatically inherits all transformations. Setting `line.visible = element.selected` toggles it without rebuilding geometry.

---

## Geometry Construction

### Custom setShape() Method

**Location:** `/js/util/three_custom.js` (lines 3-52)

```javascript
THREE.BufferGeometry.prototype.setShape = function(from, to) {
    let {position} = this.attributes;

    // East face (positive X)
    position.array.set([
        to[0], to[1], to[2],
        to[0], to[1], from[2],
        to[0], from[1], to[2],
        to[0], from[1], from[2],
    ], 0)
    // ... West, Up, Down, South, North faces ...

    position.needsUpdate = true;
}
```

**Why custom setShape instead of BoxGeometry parameters?**

1. **Performance:** BoxGeometry creates new geometry on every parameter change. `setShape()` modifies the existing BufferGeometry in-place, reusing GPU buffers.

2. **UV preservation:** Creating new geometry would reset UV coordinates. In-place modification preserves UVs while updating only positions.

3. **Custom vertex order:** The face order (East, West, Up, Down, South, North) matches Minecraft's face naming, simplifying UV application.

### updateGeometry Process

**Location:** `/js/outliner/cube.js` (lines 1154-1192)

```javascript
updateGeometry(element) {
    var from = element.from.slice()
    var to = element.to.slice()

    adjustFromAndToForInflateAndStretch(from, to, element);

    // Convert to origin-relative coordinates
    from.forEach((v, i) => {
        from[i] -= element.origin[i];
    })
    to.forEach((v, i) => {
        to[i] -= element.origin[i];
        if (from[i] === to[i]) {
            to[i] += 0.001  // Prevent degenerate geometry
        }
    })

    mesh.geometry.setShape(from, to)
}
```

**Origin-relative coordinates** (lines 1161-1169):

Three.js positions meshes based on mesh.position. The cube's geometry must be centered on its origin point, so coordinates are converted from world-space to origin-relative by subtracting the origin.

**Degenerate geometry prevention** (lines 1166-1168):

If `from[i] === to[i]`, the cube has zero thickness on that axis, creating invalid geometry that breaks raycasting and rendering. Adding 0.001 creates an extremely thin but valid cube.

---

## Face and Material System

### Face Geometry and Indices

**Location:** `/js/outliner/cube.js` (lines 1194-1256)

```javascript
updateFaces(element) {
    let indices = [];
    let j = 0;
    mesh.geometry.faces = [];
    mesh.geometry.clearGroups();
    let last_tex;

    Canvas.face_order.forEach((fkey, i) => {
        if (element.faces[fkey].texture !== null) {
            // Two triangles per face (6 indices)
            indices.push(0 + i*4, 2 + i*4, 1 + i*4,
                        2 + i*4, 3 + i*4, 1 + i*4);

            // Create geometry groups for multi-material support
            if (last_tex && element.faces[fkey].texture === last_tex) {
                mesh.geometry.groups[mesh.geometry.groups.length-1].count += 6;
            } else {
                mesh.geometry.addGroup(j*6, 6, j)
                last_tex = element.faces[fkey].texture;
            }
            j++;
        }
    })
    mesh.geometry.setIndex(indices)
}
```

**Why skip faces with null texture?**

Minecraft models can have disabled faces (e.g., interior faces). By omitting these from the index buffer, they don't render at all, improving performance and avoiding visual artifacts.

**Geometry groups for multi-material:**

Three.js supports multiple materials per geometry using groups. Each group specifies a range of indices and a material index. The code optimizes by merging consecutive faces with the same texture into a single group, reducing draw calls.

### Material Selection

The material selection logic (lines 1217-1254) handles multiple rendering modes:

```javascript
if (Project.view_mode === 'solid') {
    mesh.material = Canvas.monochromaticSolidMaterial
} else if (Project.view_mode === 'textured') {
    let materials = [];
    Canvas.face_order.forEach(function(face) {
        if (element.faces[face].texture !== null) {
            let tex = element.faces[face].getTexture();
            materials.push(tex ? tex.getMaterial() : Canvas.getEmptyMaterial())
        }
    })
    mesh.material = materials.length > 1 ? materials : materials[0];
}
```

**Material array vs single material:**

If all faces use the same texture, `materials[0]` is assigned directly. Arrays are only used when necessary, optimizing rendering performance.

---

## UV Mapping System

### Box UV Mode

**Location:** `/js/outliner/cube.js` (lines 1262-1313)

Box UV mode calculates UV coordinates based on the Minecraft texture layout:

```javascript
let face_list = [
    {face: 'east',  from: [0, size[2]],                 size: [size[2],  size[1]]},
    {face: 'west',  from: [size[2] + size[0], size[2]], size: [size[2],  size[1]]},
    {face: 'up',    from: [size[2]+size[0], size[2]],   size: [-size[0], -size[2]]},
    {face: 'down',  from: [size[2]+size[0]*2, 0],       size: [-size[0], size[2]]},
    {face: 'south', from: [size[2]*2 + size[0], size[2]], size: [size[0],  size[1]]},
    {face: 'north', from: [size[2], size[2]],           size: [size[0],  size[1]]},
]
```

**The layout:**

```
     ┌─────┬─────┬─────┬─────┐
     │     │     │     │     │
     │  -  │ Up  │  -  │  -  │ ← size[2] height
     │     │     │     │     │
     ├─────┼─────┼─────┼─────┤
     │     │     │     │     │
     │East │North│West │South│ ← size[1] height
     │     │     │     │     │
     └─────┴─────┴─────┴─────┘
       ↑     ↑     ↑     ↑
     size[2] size[0] size[2] size[0] (widths)

     Down face is above Up
```

This is Minecraft's standard box UV template, used since Minecraft 1.0.

**Mirror UV handling** (lines 1275-1292):

When `mirror_uv` is true, the East and West faces swap positions and all faces flip horizontally. This creates mirrored geometry (e.g., for a cow's left and right legs using the same texture).

### Per-Face UV Mode

**Location:** Lines 1316-1380

```javascript
Canvas.face_order.forEach((fkey, index) => {
    let face = element.faces[fkey];
    let uv = face.uv;  // [u1, v1, u2, v2]

    // Normalize to 0-1 range
    let arr = [
        [uv[0]/pw, (uv[1]/ph)/stretch+1],
        [uv[2]/pw, (uv[1]/ph)/stretch+1],
        [uv[0]/pw, (uv[3]/ph)/stretch+1],
        [uv[2]/pw, (uv[3]/ph)/stretch+1],
    ]

    // Handle rotation
    let rot = (face.rotation+0)
    while (rot > 0) {
        let a = arr[0];
        arr[0] = arr[2];
        arr[2] = arr[3];
        arr[3] = arr[1];
        arr[1] = a;
        rot = rot-90;
    }

    // Apply to geometry
    vertex_uvs.array.set(arr[0], index*8 + 0);
    vertex_uvs.array.set(arr[1], index*8 + 2);
    vertex_uvs.array.set(arr[2], index*8 + 4);
    vertex_uvs.array.set(arr[3], index*8 + 6);
})
```

**UV coordinate system:**

- Three.js uses UV coordinates where (0,0) is bottom-left, (1,1) is top-right
- Minecraft uses pixel coordinates where (0,0) is top-left
- The conversion `/pw` and `/ph` normalizes pixels to 0-1 range
- The `+1` after division flips the V coordinate (Y-axis)

**Texture animation support** (lines 1332-1366):

The `stretch` and `frame` variables support animated textures:

```javascript
if (tex instanceof Texture && tex.frameCount !== 1) {
    stretch = tex.frameCount || 1;
    if (animation === true && tex.currentFrame) {
        frame = tex.currentFrame;
    }
}
let offset = (1/stretch) * frame
arr[0][1] += offset
```

Animated textures in Minecraft are vertical strips. The V coordinate is divided by frame count, then offset by the current frame, displaying only one frame at a time.

**Rotation by vertex swapping:**

UV rotation rotates 90° by cyclically shifting vertex UVs. This avoids trigonometry and works perfectly for 90° increments.

**Box UV bleed prevention** (lines 1341-1351):

```javascript
if (element.box_uv) {
    for (let si = 0; si < 2; si++) {
        let margin = 1/64;
        if (uv[si] > uv[si+2]) margin = -margin;
        uv[si] += margin
        uv[si+2] -= margin
    }
}
```

At very low mipmap levels, texture coordinates can bleed into adjacent faces. Inset by 1/64th of a pixel prevents this artifact while being visually imperceptible.

---

## Transformation System

### Base Transformation Logic

**Location:** `/js/outliner/outliner.js` (lines 802-838)

```javascript
updateTransform(element) {
    let mesh = element.mesh;

    // Position
    mesh.position.set(element.origin[0], element.origin[1], element.origin[2])

    // Rotation (degrees → radians)
    mesh.rotation.x = Math.degToRad(element.rotation[0]);
    mesh.rotation.y = Math.degToRad(element.rotation[1]);
    mesh.rotation.z = Math.degToRad(element.rotation[2]);

    // Parent hierarchy
    if (Format.bone_rig) {
        if (element.parent instanceof OutlinerNode) {
            element.parent.mesh.add(mesh);
            // Adjust for parent origin
            mesh.position.x -= element.parent.origin[0];
            mesh.position.y -= element.parent.origin[1];
            mesh.position.z -= element.parent.origin[2];
        }
    }

    mesh.updateMatrixWorld();
}
```

**Parent-relative positioning:**

When a mesh is parented to a bone, its position must be adjusted by subtracting the parent's origin. This is because:

1. The mesh position is set to the element's absolute origin
2. Adding to a parent makes it relative to that parent's transform
3. Subtracting the parent origin converts absolute → relative

**Why updateMatrixWorld()?**

Three.js uses lazy matrix updates. Calling `updateMatrixWorld()` forces immediate recalculation of world transformation matrices, ensuring raycasting and rendering use current transforms.

### Euler Order

**Location:** Multiple files

```javascript
mesh.rotation.order = Format.euler_order
```

Different 3D formats use different rotation orders (XYZ, YXZ, ZXY, etc.). JEM/OptiFine uses a specific order that must match Minecraft's rotation system. Setting this on every mesh ensures rotations match the game.

---

## Rendering Loop

### Animation Loop

**Location:** `/js/preview/preview.js` (lines 2181-2200)

```javascript
export function animate() {
    requestAnimationFrame(animate);

    let now = Date.now();
    let time_delta = now - previous_time;

    Preview.all.forEach(function(prev) {
        if (prev.canvas.isConnected) {
            prev.render()
        }
    })

    previous_time = now;
}
```

**requestAnimationFrame synchronization:**

This browser API synchronizes rendering with the display's refresh rate (typically 60 FPS), preventing screen tearing and reducing unnecessary renders when the tab is hidden.

### Render Method

**Location:** Lines 150-2210 (Preview class)

```javascript
render() {
    this.renderer.render(scene, this.camera);
}
```

The WebGL renderer performs:

1. **Frustum culling:** Checks which objects are in camera view
2. **Depth sorting:** Orders transparent objects back-to-front
3. **Draw call batching:** Groups similar materials
4. **Shader execution:** Runs vertex and fragment shaders
5. **Output:** Renders to canvas

---

## Parser Intricacies and Design Decisions

### The `invertAxis: "xy"` Standard

**Location:** Throughout modern JEM files

Every bone in a modern JEM file includes `"invertAxis": "xy"`:

```json
{
  "part": "head",
  "invertAxis": "xy",
  "translate": [0, -24, 0]
}
```

**What does this mean?**

This tells OptiFine to invert the X and Y axes during rendering. It's a historical artifact from how OptiFine's CEM (Custom Entity Models) system evolved, but it's now standard in all modern JEM files. Blockbench always includes it when exporting.

**Why is it always "xy"?**

Modern JEM format standardized on `"xy"` as the canonical inversion mode. Other values (`"x"`, `"y"`, `"xyz"`) exist for legacy compatibility but are rarely used. The parser expects this field but doesn't strictly validate it.

### Mirror Texture Handling During Export

**Location:** `/js/io/formats/optifine_jem.js` (lines 128-145)

When exporting, Blockbench handles a complex case: bones containing cubes with different mirror states.

```javascript
if (obj.mirror_uv !== group.mirror_uv && has_different_mirrored_children) {
    if (!mirror_sub) {
        mirror_sub = {
            invertAxis: 'xy',
            mirrorTexture: 'u',
            boxes: []
        }
        p_model.submodels.splice(0, 0, mirror_sub)
    }
    mirror_sub.boxes.push(box);
}
```

**The problem:** JEM's `mirrorTexture` is bone-level, but Blockbench tracks mirroring per-cube.

**The solution:** Create an invisible submodel within the bone to hold cubes with different mirror states. This preserves per-cube control while conforming to JEM's bone-level structure.

**Example scenario:**
- A leg bone has 4 cubes
- 3 cubes use normal UV, 1 uses mirrored UV
- Export creates a hidden submodel with `mirrorTexture: 'u'` containing just that 1 cube

### Scale Property in Modern JEM

**Location:** Bone level in JEM files

Modern JEM files include a `scale` property on each bone:

```json
{
  "part": "head",
  "scale": 1.0,
  "translate": [0, -24, 0]
}
```

**What it does:** Uniformly scales the bone and all its children. This is separate from the `sizeAdd` (inflate) property on boxes.

**Typical values:**
- `1.0` - Normal size (most common)
- `0.5` - Half size
- `2.0` - Double size

**Why include it when it's 1.0?**

Modern JEM export includes `scale` even when it's the default 1.0. This maintains consistency in the file format and makes it easier for other tools to parse (they can rely on the field always existing).

### The `sizeAdd` Inflation System

**Location:** Box level in JEM files

Modern JEM boxes use `sizeAdd` for inflation:

```json
{
  "textureOffset": [0, 16],
  "sizeAdd": 0.0
}
```

**What it does:** Expands or contracts the cube in all directions by the specified amount.

**Examples:**
- `sizeAdd: 0.0` - Normal size (most common)
- `sizeAdd: 0.5` - Cube is 0.5 units larger on all sides (1.0 total expansion)
- `sizeAdd: -0.25` - Cube is 0.25 units smaller on all sides (deflation)

**Why `sizeAdd` instead of `inflate`?**

Blockbench internally uses `inflate`, but JEM uses `sizeAdd`. The parser converts between them:
- Import: `inflate: box.sizeAdd`
- Export: `sizeAdd: obj.inflate`

This naming difference is purely historical - both mean the same thing.

### Box UV Auto-Detection

**Location:** Line 366

After parsing all cubes, the parser determines whether the project should default to box UV mode:

```javascript
Project.box_uv = Cube.all.filter(cube => cube.box_uv).length > Cube.all.length/2;
```

**Why majority-based detection?**

Modern JEM files can theoretically mix box UV (`textureOffset`) and per-face UV (`uvNorth`, `uvEast`, etc.) within the same model. The project-level `box_uv` setting affects:
- Which UV editor UI is shown
- Default mode for new cubes
- Validation rules

By using majority vote (>50%), the UI matches how most of the model is structured. In practice, modern JEM files almost always use box UV exclusively, so this typically sets `Project.box_uv = true`.

### Final Steps: Canvas Update and Validation

**Location:** Lines 368-369

After all bones and boxes are parsed and added to the project, two critical operations complete the import:

```javascript
Canvas.updateAllBones();
Validator.validate()
```

**Canvas.updateAllBones():**
- Recalculates all bone transformation matrices
- Rebuilds three.js meshes for every cube
- Updates the 3D viewport to display the model
- Ensures proper parent-child hierarchy in the scene graph

**Validator.validate():**
- Checks for common JEM issues:
  - Overlapping UV coordinates (texture bleeding)
  - Invalid rotations (non-90° angles in box UV mode)
  - Zero-area faces
  - Missing textures
- Displays warnings in the UI
- Helps users fix issues before exporting back to JEM

These operations ensure the imported model is immediately viewable and any problems are surfaced to the user.

---

## Export Process: Blockbench to Modern JEM

### Compile Phase

**Location:** `/js/io/formats/optifine_jem.js` (lines 13-203)

The export process converts Blockbench's data model back to modern JEM format. Key operations include:

### Coordinate System Conversion (The Reverse)

```javascript
bone.translate = g.origin.slice()
bone.translate.V3_multiply(-1);  // Flip Y-axis: Blockbench Y-up → JEM Y-down
```

This reverses the coordinate flip from import, converting from Blockbench's Y-up system back to Minecraft's Y-down system.

**Example:**
- Blockbench head origin: `[0, 24, 0]` (24 units up)
- JEM export: `[0, -24, 0]` (24 units down in Minecraft)

### Texture Path Export with Namespace Support

**Location:** Lines 19-24

Modern JEM files support Minecraft namespaces in texture paths:

```javascript
function getTexturePath(tex) {
    let path = tex.name;
    if (tex.folder) path = tex.folder + '/' + path;
    if (tex.namespace && tex.namespace != 'minecraft') path = tex.namespace + ':' + path;
    return path;
}
```

**Export examples:**
- `textures/entity/cow.png` → `"textures/entity/cow"`
- Custom namespace → `"mymod:textures/entity/custom"`
- Default namespace → `"textures/entity/sheep"` (minecraft: is implied)

The `.png` extension is omitted in modern JEM files - it's implied.

### Empty Bone Filtering

**Location:** Line 43

Modern JEM export can optionally skip empty bones:

```javascript
if (!settings.export_empty_groups.value && !g.children.find(child => child.export)) return;
```

**When is a bone considered "empty"?**
- No boxes in its `boxes` array
- No submodels with content
- No children marked for export

**Why filter them out?**
- Reduces JEM file size
- Improves OptiFine parsing performance
- Cleaner file structure

**When to keep them:**
- Bone is needed as an animation target
- Bone serves as a pivot point for children
- Preserving exact bone hierarchy for compatibility

The user can control this via the `export_empty_groups` setting.

### Submodel Coordinate Adjustment (Export)

**Location:** Lines 161-165

When exporting nested bones (submodels), the coordinates must be converted from absolute to parent-relative:

```javascript
if (depth >= 1) {
    bone.translate[0] -= group.origin[0];
    bone.translate[1] -= group.origin[1];
    bone.translate[2] -= group.origin[2];
}
```

This is the inverse of the import process:
- **Import:** Add parent origin (relative → absolute)
- **Export:** Subtract parent origin (absolute → relative)

**Example:**
- Blockbench: Hat bone at absolute `[0, 26, 0]`, parent head at `[0, 24, 0]`
- JEM export: Hat `translate: [0, 2, 0]` (26 - 24 = 2, relative to parent)

---

## Performance Optimizations

### Texture Instance Reuse

During parsing, the `imported_textures` cache ensures each texture path creates only one Texture instance, reducing memory usage and improving performance in models with many cubes sharing textures.

### In-Place Geometry Updates

The custom `setShape()` method modifies geometry in-place rather than creating new geometry, preserving GPU buffers and avoiding garbage collection overhead.

### Material Grouping

The `updateFaces()` method merges consecutive faces with the same texture into single geometry groups, reducing draw calls and improving rendering performance.

### Lazy Matrix Updates

Three.js only recalculates transformation matrices when `updateMatrixWorld()` is called, avoiding redundant calculations during batch operations.

---

## Conclusion

The modern JEM rendering pipeline in Blockbench demonstrates sophisticated handling of Minecraft's custom entity model format while providing a seamless editing experience. The complete flow encompasses:

### Critical Design Decisions

1. **Y-axis coordinate system conversion** - Every bone origin is multiplied by -1 during import and export to convert between Minecraft's Y-down and Blockbench's Y-up coordinate systems. This bidirectional conversion is essential for compatibility.

2. **Box UV mode as the standard** - Modern JEM files primarily use box UV (`textureOffset` + `textureSize`) rather than per-face UVs. This matches Minecraft's vanilla model format and simplifies texture creation for artists.

3. **Texture-driven geometry** - The `coordinates` field is optional in modern JEM files. Box dimensions can be inferred from UV layout, reducing file size and emphasizing the texture-first workflow.

4. **Parent-relative coordinate spaces** - Top-level bones use absolute positions, while submodels use parent-relative positions. The parser carefully converts between these during import/export.

5. **Namespace-aware texture paths** - Full support for Minecraft resource pack namespaces (`minecraft:`, `modid:`) with intelligent path resolution and automatic `.png` extension handling.

6. **Scale and inflation separation** - Bone-level `scale` (uniform scaling) is distinct from box-level `sizeAdd` (inflation). Both are preserved through the import/export cycle.

### Rendering Architecture

The three.js rendering system efficiently handles:
- **In-place geometry updates** via custom `setShape()` method
- **Material batching** by grouping faces with the same texture
- **Lazy matrix recalculation** for optimal performance
- **60 FPS rendering loop** synchronized with browser refresh rate

### Parser Robustness

The parser handles edge cases like:
- Mixed mirror UV states within a single bone (creates intermediate submodels)
- Optional coordinates (uses defaults when omitted)
- Texture inheritance chains (submodel → parent → model default)
- Empty bone filtering (configurable for file size optimization)

This architecture enables Blockbench to serve as a professional editor for OptiFine JEM models, maintaining full fidelity with the modern JEM format while leveraging three.js for real-time 3D preview and manipulation.
