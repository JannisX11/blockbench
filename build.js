import * as esbuild from 'esbuild'
import { glsl } from "esbuild-plugin-glsl";
import { createRequire } from "module";
import commandLineArgs from 'command-line-args'
import path from 'path';
import { writeFileSync } from 'fs';
const pkg = createRequire(import.meta.url)("./package.json");

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
    plugins: [
        conditionalImportPlugin({
            file: isApp ? 'desktop.js' : 'web.js'
        }),
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
