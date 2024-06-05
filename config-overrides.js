const { override, addBabelPreset, addBabelPlugin, addWebpackModuleRule } = require('customize-cra');

module.exports = override(
  addBabelPreset('@babel/preset-env'),
  addBabelPreset('@babel/preset-react'),
  addBabelPlugin('@babel/plugin-proposal-optional-chaining'),
  addBabelPlugin('@babel/plugin-proposal-nullish-coalescing-operator'),
  addBabelPlugin('@babel/plugin-proposal-logical-assignment-operators'),
  addWebpackModuleRule({
    test: /\.m?js$/,
    exclude: /node_modules\/(?!yaml)/, // Include yaml package and any other you need
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env', '@babel/preset-react'],
        plugins: [
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-logical-assignment-operators'
        ]
      }
    }
  })
);
