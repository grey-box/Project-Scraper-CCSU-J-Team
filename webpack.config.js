const path = require('path');
(CopyWebpackPlugin = require('copy-webpack-plugin')),
  (HtmlWebpackPlugin = require('html-webpack-plugin'));
module.exports = {
  entry: {
    popup: path.join(__dirname, 'src', 'js', 'popup.js'),
    background: path.join(__dirname, 'src', 'js', 'background.js'),
    contentScript: path.join(__dirname, 'src', 'js', 'contentScript.js'),
    options: path.join(__dirname, 'src', 'js', 'options.js'),
    window: path.join(__dirname, 'src', 'js', 'window.js'),
  },
  output: {
    globalObject: 'this',
    path: path.join(__dirname, 'build'),
    filename: 'js/[name].bundle.js',
  },
  watchOptions: {
    ignored: ['node_modules', 'build'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json' },
        { from: 'src/css', to: 'css' },
        { from: 'src/images' , to: 'images'},
      ],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'html', 'popup.html'),
      filename: 'html/popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'html', 'options.html'),
      filename: 'html/options.html',
      chunks: ['options'],
    }),
    new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src', 'html', 'window.html'),
        filename: 'html/window.html',
        chunks: ['window'],
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'src', 'html', 'tutorial.html'),
        filename: 'html/tutorial.html',
        chunks: ['tutorial'],
      }),  
  ],
};
