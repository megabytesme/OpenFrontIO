const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./src/headless/index.ts",
  mode: "production",
  target: "web",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "headless.bundle.js",
    clean: true,
  },
  optimization: {
    splitChunks: false,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.headless.json",
            },
          },
        ],
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(txt|md)$/i,
        type: "asset/source",
      },
      {
        test: /\.json$/,
        type: 'json',
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      vm: require.resolve("vm-browserify"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
};