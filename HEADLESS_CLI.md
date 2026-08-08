# Headless CLI

Blockbench can run one model-editing action without showing a window or starting
a server. Each invocation creates an isolated temporary profile, opens the model
through Blockbench's normal codec, runs trusted JavaScript in the real renderer,
saves a new `.bbmodel` through the project codec, and exits.

## Run from source

Build the renderer once:

```sh
npm install
npm run build-electron
```

Then run an action:

```sh
npm run headless -- \
  --input creature.bbmodel \
  --script remove_saddle.js \
  --output creature_without_saddle.bbmodel
```

Packaged builds use the same arguments directly on the Blockbench executable:

```sh
Blockbench --headless \
  --input creature.bbmodel \
  --script remove_saddle.js \
  --output creature_without_saddle.bbmodel
```

Use `--force` to replace an existing output. The input is never changed unless
the same path is explicitly supplied as output together with `--force`.

## Script environment

Scripts run after the model and its textures are ready. Blockbench's live globals
are available directly, including `Project`, `Cube`, `Group`, `Mesh`, `Texture`,
`Undo`, `Canvas`, and `Blockbench`:

```js
const saddle = Group.all.find(group => group.name === 'saddle')
if (!saddle) throw new Error('Saddle group not found')

const affected = saddle.getAllChildren()
saddle.remove(true)
Canvas.updateAll()

return {removed: saddle.name, affected: affected.length}
```

The script body is an async function, so top-level `await` and `return` work.
It also receives these variables:

- `context`: `{input, output, args, Blockbench, globals, project, waitForTextures}`
- `input` and `output`: resolved absolute paths
- `args`: values after `--`
- `module` and `exports`: optional CommonJS-style export support

Instead of using a script body, a file can export a function:

```js
module.exports = async ({args}) => {
  Cube.all[0].name = args[0]
  return {renamed: Cube.all[0].uuid}
}
```

Run it with arguments using `-- old_name new_name`. For short actions,
`--eval <javascript>` can be used instead of `--script`.

Scripts are not sandboxed. They run with the desktop app's local permissions and
must be trusted.

## Process contract

The last stdout line is a JSON result. Script `console` output is written to
stderr so callers can parse stdout reliably.

Successful result:

```json
{"ok":true,"input":"...","output":"...","phase":"complete","exitCode":0,"format":"free","elements":12,"durationMs":913,"result":{"removed":"saddle"}}
```

Failed result:

```json
{"ok":false,"input":"...","output":"...","phase":"script","exitCode":5,"error":{"name":"Error","message":"Saddle group not found"}}
```

Exit codes are `0` for success, `2` for invalid arguments, `3` for input/load
errors, `4` for output/save errors, `5` for script errors, `6` for renderer or
runtime errors, and `124` for a timeout.

Every invocation is independent. It does not load installed plugins, contact the
plugin API or updater, modify recent projects, start backups, or reuse a profile.
This lets multiple processes edit different files concurrently without sharing
`Project`, `Undo`, scene, or codec state.
