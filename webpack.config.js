const PathModule = require('path')
const {DefinePlugin} = require('webpack')

module.exports = {
    mode: 'production',
    target: 'node',
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: __dirname
    },
    module: {
        rules: [
            {
                test: /\.(jpg|png)$/,
                use: {
                    loader: 'url-loader'
                }
            },
            {
                test: /\.bbkeymap$/,
                type: 'json'
            },
            {
                test: /\.bbtheme$/,
                type: 'json'
            }
        ]
    },
    plugins: [
        new DefinePlugin({
            BBVERSION: `"${require('./package.json').version}"`
        })
    ]
}
