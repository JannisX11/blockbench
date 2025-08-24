import * as esbuild from 'esbuild'
import { glsl } from "esbuild-plugin-glsl";
import { createRequire } from "module";
import commandLineArgs from 'command-line-args'
import path from 'path';
import { writeFileSync } from 'fs';
import fs from 'node:fs';
import vuePlugin from 'esbuild-vue/src/index.js';
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const options = commandLineArgs([
    {name: 'target', type: String},
    {name: 'watch', type: Boolean},
    {name: 'serve', type: Boolean},
    {name: 'analyze', type: Boolean},
])

function conditionalImportPlugin(config) {
    return {
        name: 'conditional-import-plugin',
        setup(build) {
            build.onResolve({ filter: /desktop.js$/ }, args => {
                return { path: path.join(args.resolveDir, config.file) };
            });
        }
    };
};
function createJsonPlugin(ext_suffix, namespace) {
    return {
        name: `${namespace}-plugin`,
        setup(build) {
            // Intercept import paths with the specified extension
            build.onResolve({ filter: new RegExp(`${ext_suffix}$`) }, args => ({
                path: path.join(
                    args.resolveDir,
                    args.path
                ),
                namespace: `${namespace}-ns`,
            }))

            // Load paths tagged with the specified namespace and treat them as JSON
            build.onLoad({ filter: /.*/, namespace: `${namespace}-ns` }, async (args) => {
                // Read the content of the file
                const content = await fs.promises.readFile(args.path, 'utf8');

                // Return the content as JSON
                return {
                    contents: content,
                    loader: 'json',
                }
            })
        }
    };
};

const isApp = options.target == 'electron';
const dev_mode = options.watch || options.serve;
const minify = !dev_mode;

/**
 * @typedef {esbuild.BuildOptions} BuildOptions
 */
const config = {
    entryPoints: ['./js/main.js'],
    define: {
        isApp: isApp.toString(),
        appVersion: `"${pkg.version}"`,
    },
    platform: 'node',
    target: 'es2020',
    format: 'esm',
    bundle: true,
    minify,
    outfile: './dist/bundle.js',
    mainFields: ['module', 'main'],
    external: [
        'electron',
    ],
    loader: {
        '.bbtheme': 'text'
    },
    plugins: [
        conditionalImportPlugin({
            file: isApp ? 'desktop.js' : 'web.js'
        }),
        createJsonPlugin('.bbkeymap', 'bbkeymap'),
        vuePlugin(),
        glsl({
            minify
        })
    ],
    sourcemap: true,
}

if (options.watch || options.serve) {
    let ctx = await esbuild.context(config);
    if (isApp) {
        await ctx.watch({});
    } else {
        const host = 'localhost';
        const port = 3000;
        await ctx.serve({
            servedir: import.meta.dirname,
            host,
            port
        });
        console.log(`Hosting app at http://${host}:${port}`)
    }
} else {
    if (options.analyze) config.metafile = true;
    let result = await esbuild.build(config);
    if (options.analyze) {
        writeFileSync('./dist/esbuild-metafile.json', JSON.stringify(result.metafile))
    }
}
