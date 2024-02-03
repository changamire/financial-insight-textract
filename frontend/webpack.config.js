const HtmlWebPackPlugin = require('html-webpack-plugin');

const htmlPlugin = new HtmlWebPackPlugin({
  template: './index.html',
  filename: './index.html'
});

module.exports = {
  entry: './index.tsx',
  output: {
    path: __dirname + '/www',
    publicPath: ''
  }, 
  devServer: {
    client: {
      overlay: false
    }
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-flow']
          }
        }
      },
      { test: /\.css/, use: ['style-loader', 'css-loader'] }
    ]
  },
  plugins: [htmlPlugin]
};
