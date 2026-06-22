# Vintage Bench Removal Notes

## First-pass scope

This pass keeps Blockbench's generic cuboid editor usable while removing user-facing Minecraft, Bedrock, mesh, and hosted-web surfaces. It does not implement the final Vintage Story shape schema yet. Save/load will continue to use Blockbench's stable project serializer internally, but the desktop project extension and file picker filters should move to `.json`.

## Vintage Story reference findings

- `.resources/vsmodelcreator-master/vsmodelcreator-master/src/at/vintagestory/modelcreator/Exporter.java` writes Vintage Story shape JSON with `textureWidth`, `textureHeight`, `textureSizes`, `textures`, `elements`, nested `children`, `attachmentpoints`, and `rotationOrigin`.
- `.resources/vsmodelcreator-master/vsmodelcreator-master/src/at/vintagestory/modelcreator/model/JsonShape.java`, `JsonElement.java`, and `JsonFace.java` show the older core DTO surface: shape `textures` plus root `elements`, element `from`/`to`/`faces`/rotation fields, and face `texture`/`uv`/`enabled`.
- `.resources/vsmc2-main/vsmc2-main/VSModelCreatorProto/Assets/Scripts/JSON/Definitions/Shape.cs` and `ShapeElement.cs` confirm modern VS hierarchy assumptions: recursive `Elements`/`Children`, `AttachmentPoints`, `StepParentName`, texture size data, face metadata, and per-element transforms.
- TODO: implement a true Vintage Story JSON codec that maps Blockbench cubes/outliner hierarchy to VS `elements` and preserves texture keys, face metadata, attachment points, and animation data.

## Blockbench surfaces found

- `js/main.ts` imports all built-in format modules. Removing an import is the safest way to stop a format, codec, import/export action, and format page from registering.
- `js/io/format.ts` owns `ModelFormat` registration and feature flags such as `meshes`, `splines`, `texture_meshes`, `display_mode`, `bone_rig`, and `locators`.
- `js/interface/start_screen.js` builds the New screen from `Formats` and `ModelLoader.loaders` using `show_on_start_screen`.
- `js/formats/generic.ts` defines the Generic Model format. It currently enables meshes, splines, armature rigging, and PBR; this needs to become the cuboid-focused Vintage Bench base.
- `js/formats/bbmodel.js` owns the main project codec, save/open actions, `.bbmodel` extension, project import, incremental save naming, and legacy project export.
- `js/io/io.js` owns the Open Model dialog and drag/drop routing. It also assumes `Formats.skin` exists for square skin PNGs.
- `js/interface/menu_bar.js` lists import/export action IDs and mesh/Minecraft-specific menus. If removed format modules are not imported the actions do not register, but the menu lists should also be cleaned.
- `js/interface/toolbars.js` lists toolbar action IDs, including Bedrock animation and mesh editing actions.
- `js/modeling/mesh_editing.js` imports mesh edit tools, mesh primitives, OBJ import, and mesh actions.
- `js/modeling/mesh/add_mesh.ts` registers Add Mesh and mesh primitives.
- `js/modeling/mesh/import_obj.ts` registers OBJ mesh import.
- `js/outliner/types/mesh.js` is both an internal element class and renderer/update surface. It should remain for safe legacy project parsing/internal rendering, but mesh creation should be unavailable.
- `js/display_mode/display_mode.js` defines display slots, display presets, reference models, and shelf/frame reference behavior.
- `js/display_mode/DisplayModePanel.vue` renders display slot buttons. The frame button and center shelf path are user-facing removal targets.
- `package.json`, `build.js`, `js/boot_loader.js`, `js/web.js`, and `scripts/generate_pwa.js` contain hosted web/PWA/build paths. For this pass, remove web scripts/package paths and service-worker/PWA branches while keeping desktop build paths.

## Implemented cleanup

- The project codec is now externally `.json`, but it still serializes the stable Blockbench project payload. TODO: replace this with true Vintage Story shape JSON once the mapping is designed and tested.
- The Generic Model format is the only registered creation format and is configured as a cuboid-first Vintage Bench base with mesh/spline/armature/PBR feature flags disabled.
- Removed user-facing import/export/menu/toolbar entries for Java, Bedrock, OptiFine, skin, OBJ/mesh, legacy project export, sharing, and asset archive paths. Save/Save As is the JSON-oriented project flow for now.
- Removed Minecraft display references requested in the cleanup pass, the Frame display slot, and the Shelf Center reference. GUI remains available.
- Desktop build/package metadata now uses Vintage Bench and `.json`; hosted web/PWA scripts, `js/web.js`, and service-worker registration were removed/disabled.

## Intentional deferrals

- Full Vintage Story JSON import/export.
- Vintage Story display presets and GUI calibration.
- Vintage Story shelf display logic: vanilla shelves have left/right and top/bottom shelf sections, two slots per section, for eight item slots total.
- Runtime removal of shared mesh classes that are still referenced by generic renderer/outliner/serialization internals.
- Full branding sweep of every Blockbench string and URL.
