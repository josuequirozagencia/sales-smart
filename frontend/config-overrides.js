const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = function override(config, env) {
  // Otimização de bundle splitting
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        // Vendor chunks organizados por tamanho
        vendorCore: {
          name: 'vendor-core',
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
          priority: 40,
        },
        vendorMUI: {
          name: 'vendor-mui',
          test: /[\\/]node_modules[\\/](@mui|@material-ui|@emotion)[\\/]/,
          priority: 30,
        },
        vendorUtils: {
          name: 'vendor-utils',
          test: /[\\/]node_modules[\\/](lodash|moment|date-fns|axios)[\\/]/,
          priority: 20,
        },
        vendorChunks: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `vendor.${packageName.replace('@', '')}`;
          },
          priority: 10,
          minSize: 50000,
          maxSize: 200000,
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          enforce: true,
        },
      },
    },
    runtimeChunk: 'single',
    minimize: env === 'production',
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: env === 'production',
          },
          mangle: {
            safari10: true,
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
        parallel: true,
      }),
    ],
  };

  // Adicionar compressão gzip em produção
  if (env === 'production') {
    config.plugins.push(
      new CompressionPlugin({
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8,
      })
    );
  }

  // Otimizar resolução de módulos
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
      'components': require('path').resolve(__dirname, 'src/components'),
      'hooks': require('path').resolve(__dirname, 'src/hooks'),
      'pages': require('path').resolve(__dirname, 'src/pages'),
      'services': require('path').resolve(__dirname, 'src/services'),
      'context': require('path').resolve(__dirname, 'src/context'),
    },
  };

  // Adicionar webpack bundle analyzer em desenvolvimento
  if (env === 'development') {
    const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'disabled',
        generateStatsFile: true,
        statsOptions: { source: false }
      })
    );
  }

  // Configurar cache para melhor performance em desenvolvimento
  if (env === 'development') {
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    };
  }

  return config;
};