# ROADMAP

This is a roadmap for splines, listing all features I want to implement for them. This file is to be DELETED upon merging with Blockbench.

## **M1** Base functionality
- [x] Make it so moving one control mirrors on the other, unless a key modifier is held (alt, ctrl...). 
  - > key modifier replaced by on-ui option.
- [x] Implement proper graphics for spline handles, so that the connection between controls and origin are clear.
- [x] Add cyclic functionality, closes the spline from the first to last handle with an additional segment. 
  - > Basic functionality for this added, but might need updating later on
- [x] Implement primitive tube drawing, using resolution U as the number of points per slice.
  - [x] Needs to respect tilt & size.
  - [ ] Would ideally generate a special version of
    UV islands that would correspond to slices 
    of the resulting tube (one per U edge).
  - > probably done, might need more refinement
- [x] Fix cyclic tube mesh not connecting properly.
- [x] Add spline to mesh conversion, so that the spline can be edited as a normal mesh.

## **M2** Editing functionality
- [x] Fix texture not rendering on splines.
- [x] Create Gizmo for spline handles, to de-clutter preview controller geo.
- [x] Add ability to extrude points from the curve.
- [x] Add ability to scale & tilt handles. (radius & tilt)
- [x] Implement `apply_spline_rotation` action.
- [x] Implement spline creation dialog.
- [x] Apply handle mode effects to Scaling and Rotating.
- [x] Make it so "local" transform mode aligns with spline control/handle normal.
- [x] Implement `split_spline` action.
- [x] Implement `subdivide_segment` action.
- [x] Solid buffer order
  - All of the below features Require:
    - [x] to fix Undo for curves so that point orders don't get messed up.
    - [x] ~~that the renderer of the curve doesn't add mesh if a curve is missing along the path.~~
    - [x] that the renderer of the curve properly renders cyclicity.

  - [x] ~~Add ability to delete **handles** from the curve.~~
    - > removed in favor of dissolve, would have caused too many headaches for the current impl.
  - [ ] ~~Add ability to remove segments (curves) from the curve.~~
    - > cancelled, would have caused too many headaches for the current impl.
  - [x] Add ability to dissolve points from the curve.

## **M3** Advanced functionality & QoL
- [ ] Add ability to choose a custom mesh for the spline's ring profile.
- [ ] Implement `merge_splines` action. (This one might be a bit difficult to get right)
- [ ] Implement exporting for `fbx`,  `GLtf` & other formats.
- [ ] Add indicators for start and end of a spline, displayed over their handles.
- [ ] Make it impossible to shrink handles to size 0. (might not be necessary, but would be nice as QoL)
- [ ] Code clean up, where/if required.

# Known Issues

### Critical
- [x] spline selection position isn't used in the element panel's `position` field.
- [x] undoing sometimes doesn't visually update spline positions in-world.
- [x] handle dissolving breaks cyclic splines.
- [x] Undoing handle deletions causes the spline mesh to be jumbled and messed up permanently.
  - Requires "Solid buffer order"
  - > added "overwrite" method to splines, used when undoing changes. Will preserve order of all touchy data.
- [x] Handle Gizmos leave trails of their lines when moved. (new system)
- [x] Closing a project with a spline selected in handles mode leaves an empty canvas in the scene with no possibility to close it.
- [x] Selecting one or more points and selecting another spline keeps the previous spline displayed as selected. (except when point is pressed twice???)
- [x] Hint to press shift to select multiple spline points sticks around when a spline is unselected.

### Low Priority
- [ ] Spline handles will sometimes be a little finnicky to select.
- [x] Converting a spline to a mesh creates a mesh with all faces detached from one another.
- [x] Handle Gizmos don't highlight anymore. (new system)
- [x] Hint to press shift to select multiple spline points doesn't appear immediately when selection modes are switched.
- [x] Extrusion can be used when the selection doesn't match the criterias for selecting.
- [ ] Look into making splines animatable. (might not be feasible atm)
- [ ] Spline Render Properties always display on the elements panel.
- [ ] Spline handle gizmos cause a bit of frame drops.
- [ ] Spline outline wireframe is missing one singular edge loop at the start of the spline.
- [^x] Handle Gizmo joints will sometimes orient wrongly.

### Deprecated matters
- [ ] ~~handle deletion breaks cyclic splines.~~
- [ ] ~~handle dissolving bridges back all disconnected handles.~~
- [ ] ~~Tilting is currently extremely finnicky and doesn't behave as expected ~3 times out of 4.~~
  - > Changed methods for tilting handles, it is now a slider in the Elements panel.