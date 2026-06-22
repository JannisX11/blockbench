# Changelog

## Unreleased

### Changed

- Marked the project as Vintage Bench, a modified fork of Blockbench for
  Vintage Story-focused cuboid model editing.
- Limited the active new-project format surface to Generic Model.
- Changed the external project save/open extension to `.json` while retaining
  the internal project serializer as a temporary compatibility measure.
- Removed or disabled user-facing Minecraft-specific, Bedrock-specific,
  OptiFine-specific, skin, mesh, web application, hosted sharing, and legacy
  conversion workflows.
- Removed Minecraft-oriented display references requested for the first
  cleanup pass, including frame display, shelf center, zombie, baby zombie,
  small armor stand, crossbow, horn, and fox references.

### Added

- Added fork notice, source-code availability, third-party notices, and this
  changelog to document license and modification status.

### TODO

- Implement true Vintage Story shape JSON import/export.
- Add Vintage Story display presets and shelf slot logic.
- Calibrate GUI display behavior for Vintage Story.
- Review remaining dormant legacy modules for safe deletion after the desktop
  editor surface is proven stable.
