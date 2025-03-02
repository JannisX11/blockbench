import * as esbuild from 'esbuild'
import { createRequire } from "module";
import commandLineArgs from 'command-line-args'
import path from 'path';
const pkg = createRequire(import.meta.url)("./package.json");

const options = commandLineArgs([
    {name: 'target', type: String},
    {name: 'watch', type: Boolean}
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

if (options.watch) {
    async function watch() {
        let ctx = await esbuild.context(config);
        await ctx.watch({});
        console.log('Watching files')
    }
    watch();
} else {
    await esbuild.build(config);
}
