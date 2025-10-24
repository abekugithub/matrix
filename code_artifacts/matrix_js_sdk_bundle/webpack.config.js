const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './src/index.js',
    output: {
        filename: 'matrix-sdk.min.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'matrixcs',
            type: 'umd',
            export: 'default',
        },
        globalObject: 'this',
    },
    resolve: {
        extensions: ['.js', '.ts', '.wasm'],
        fallback: {
            "crypto": false,
            "stream": false,
            "buffer": false,
            "util": false,
            "url": false,
            "events": false,
            "path": false,
            "fs": false,
        }
    },
    module: {
        rules: [
            {
                test: /\.wasm$/,
                type: 'asset/resource',
                generator: {
                    filename: '[name][ext]'
                }
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: 'node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/*.wasm',
                    to: '[name][ext]',
                },
            ],
        }),
    ],
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: false,
                    },
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
    },
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000
    },
    experiments: {
        asyncWebAssembly: true,
    },
};
