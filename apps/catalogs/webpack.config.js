const GeneratePackageJsonPlugin = require('generate-package-json-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const path = require('path');

const versionsPackageFilename = __dirname + "/package.json";
const basePackageValues = {
    name: "@ignition/api",
    version: "1.0.0",
    description: "Packaged externals for bowtie-api",
    private: true,
};

module.exports = {
    mode: 'development',
    devtool: 'source-map',
    entry: './src/index.ts',
    target: 'node',
    module: {
        rules: [
            {
                test: /\.ts(x?)$/,
                loader: 'ts-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    },
    output: {
        libraryTarget: 'commonjs',
        path: path.join(__dirname, '.webpack'),
        filename: 'index.js'
    },
    externals: [nodeExternals({modulesFromFile: true, whitelist: [/^@ignition/]})],
    plugins: [
        new GeneratePackageJsonPlugin(basePackageValues, versionsPackageFilename),
    ],
};
