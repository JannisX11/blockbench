# Vintage Bench

Vintage Bench is a modified fork of [Blockbench](https://github.com/JannisX11/blockbench) focused on becoming a Vintage Story cuboid JSON model editor.

This first cleanup pass keeps the desktop cuboid editor usable while removing hosted web/PWA paths and user-facing Minecraft, Bedrock, mesh, and legacy project workflows. The current project serializer still uses the stable internal Blockbench project payload, but save/open defaults now use `.json` as the external project extension.

Vintage Bench is not affiliated with, endorsed by, or sponsored by the original Blockbench project or by the owners or developers of Vintage Story.

## Setup

Install dependencies:

```sh
npm install
```

Build the desktop bundle:

```sh
npm run build-electron
```

Run the Electron desktop app:

```sh
npm run dev
```

## License

Vintage Bench is a modified fork of Blockbench.

The original Blockbench source code is licensed under the GNU General Public License version 3. Vintage Bench is distributed under the GNU General Public License version 3 as a modified version of Blockbench.

See [LICENSE.MD](./LICENSE.MD) for the full GPL-3.0 license text.

Original Blockbench copyright notices are retained from the original project and its contributors. Vintage Bench modifications are Copyright (C) 2026 P1nkOblivion.

Source code for this fork is available at:

https://github.com/p1nkoblivion/VintageBench

Vintage Bench is provided WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

See also:

- [NOTICE](./NOTICE)
- [SOURCE_CODE.md](./SOURCE_CODE.md)
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
- [CHANGELOG.md](./CHANGELOG.md)

## User-Created Assets

Models, textures, animations, screenshots, and other assets created with Vintage Bench are owned by their creators. Using Vintage Bench does not automatically license user-created assets under GPL-3.0.

## Next Major Work

- Implement a real Vintage Story shape JSON codec.
- Replace display presets with Vintage Story-calibrated presets.
- Implement Vintage Story shelf display sections and slots.
- Revisit any internal mesh compatibility code once legacy loading requirements are clearer.
