import * as esbuild from 'esbuild'
import { createRequire } from "module";
import commandLineArgs from 'command-line-args'
import path from 'path';
const pkg = createRequire(import.meta.url)("./package.json");

const options = commandLineArgs([
    {name: 'target', type: String},
    {name: 'watch', type: Boolean},
    {name: 'serve', type: Boolean},
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

let isApp = options.target == 'electron';

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
    minify: false,
    outfile: './dist/bundle.js',
    external: [
        'electron',
    ],
    plugins: [
        conditionalImportPlugin({
            file: isApp ? 'desktop.js' : 'web.js'
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
    await esbuild.build(config);
}
