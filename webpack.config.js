var path = require('path')
var webpack = require('webpack')

var config = {
  entry: {
    index: './src/index'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules/,
        include: __dirname
      }
    ]
  }
}

module.exports = config
