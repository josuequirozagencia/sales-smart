const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

// Configuração de build sobre o Create React App 5.
//
// Substitui o antigo config-overrides.js. O react-app-rewired 2.2.1 é a última
// versão publicada e foi feita para o CRA 4; o CRACO é mantido e declara
// suporte ao CRA 5, então é a base mais segura daqui em diante.
//
// A troca de ferramenta, porém, não foi o que consertou o servidor de
// desenvolvimento: ele continuava subindo, abrindo a porta e nunca servindo a
// página, tanto com rewired quanto com CRACO. O culpado era aplicar a
// configuração de splitChunks também em desenvolvimento — ver o comentário
// junto ao `if (env !== 'production')` mais abaixo.

module.exports = {
  webpack: {
    configure: (config, { env }) => {
      // ── webpack 5: polyfills de módulos do Node ────────────────────────
      // O webpack 4 injetava polyfills de core modules automaticamente; o 5
      // não. Sem isto, qualquer dependência que faça require('stream') e
      // afins quebra o build com "Can't resolve ...".
      //
      // `false` significa "devolva um módulo vazio", que é o certo para o que
      // só existe no ramo Node da biblioteca: o xlsx, por exemplo, testa o
      // ambiente antes de tocar em `fs`.
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...(config.resolve && config.resolve.fallback),
          assert: require.resolve('assert/'),
          buffer: require.resolve('buffer/'),
          crypto: require.resolve('crypto-browserify'),
          http: require.resolve('stream-http'),
          https: require.resolve('https-browserify'),
          os: require.resolve('os-browserify/browser'),
          path: require.resolve('path-browserify'),
          // Com extensão: sob a resolução estrita de ESM do webpack 5, pedir
          // 'process/browser' sem o .js falha com "failed to resolve only
          // because it was resolved as fully specified".
          process: require.resolve('process/browser.js'),
          stream: require.resolve('stream-browserify'),
          url: require.resolve('url/'),
          util: require.resolve('util/'),
          // Exclusivos de Node: não há equivalente de navegador.
          child_process: false,
          fs: false,
          net: false,
          tls: false,
          zlib: false,
        },
        alias: {
          ...(config.resolve && config.resolve.alias),
          '@': path.resolve(__dirname, 'src'),
          components: path.resolve(__dirname, 'src/components'),
          hooks: path.resolve(__dirname, 'src/hooks'),
          pages: path.resolve(__dirname, 'src/pages'),
          services: path.resolve(__dirname, 'src/services'),
          context: path.resolve(__dirname, 'src/context'),
        },
      };

      // Vários pacotes assumem `process` e `Buffer` globais, o que era verdade
      // no webpack 4 e deixou de ser no 5.
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      // Arquivos .mjs publicados são ESM estrito, o que exige extensão em todo
      // import e faz falhar pedidos legítimos vindos de dependências.
      config.module.rules.push({
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      });

      // O CRA 5 já configura Terser e CssMinimizerPlugin. Substituir o array
      // inteiro de minimizadores — como fazia a configuração anterior —
      // desligaria a minificação de CSS sem aviso nenhum. Só o Terser é
      // trocado pelo nosso, que remove console.* em produção.
      const craMinimizers = (config.optimization && config.optimization.minimizer) || [];
      const keepMinimizers = craMinimizers.filter(
        p => p && p.constructor && p.constructor.name !== 'TerserPlugin'
      );

      // Cache em disco acelera as recompilações seguintes em desenvolvimento.
      if (env === 'development') {
        config.cache = {
          type: 'filesystem',
          buildDependencies: { config: [__filename] },
        };
      }

      // Daqui para baixo, só produção.
      //
      // Afinar splitChunks é uma preocupação de entrega: em desenvolvimento o
      // CRA desliga o code splitting de propósito, porque quebrar o bundle em
      // centenas de chunks a cada recompilação torna o HMR lento. Aplicar esta
      // configuração também em dev era o que travava o servidor: ele abria a
      // porta e nunca chegava a servir a página. O build de produção, que usa
      // exatamente os mesmos ajustes, sempre funcionou.
      if (env !== 'production') {
        return config;
      }

      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
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
                // module.context pode ser null no webpack 5 (módulos gerados
                // em runtime não têm diretório de origem) e o caminho nem
                // sempre casa com a regex. Sem estas guardas o build morre com
                // "Cannot read properties of null (reading '1')" no seal.
                const context = (module && module.context) || '';
                const match = context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);

                if (!match) return 'vendor.misc';

                return `vendor.${match[1].replace('@', '')}`;
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
              parse: { ecma: 8 },
              compress: {
                ecma: 5,
                comparisons: false,
                inline: 2,
                drop_console: env === 'production',
              },
              mangle: { safari10: true },
              format: { ecma: 5, comments: false, ascii_only: true },
            },
            parallel: true,
          }),
          ...keepMinimizers,
        ],
      };

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

      // Bundle analyzer sob demanda: `ANALYZE=true npm start`.
      //
      // Antes rodava em TODA compilação de desenvolvimento com
      // `generateStatsFile: true`, gerando um dist/stats.json de ~177 MB a cada
      // build — e com `analyzerMode: 'disabled'` esse arquivo não servia para
      // nada. Era um peso morto em cada compilação.
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html',
            generateStatsFile: false,
          })
        );
      }

      return config;
    },
  },

  devServer: devServerConfig => {
    // O package.json define `"proxy": "http://localhost:8080"`. Com proxy
    // ativo o CRA monta `allowedHosts: [lanUrlForConfig]`, e quando HOST é um
    // endereço de loopback esse valor vem `undefined` — o CRA só calcula URL
    // de rede local quando o host é 0.0.0.0. O resultado é um array com um
    // item vazio, que o webpack-dev-server 4 rejeita com
    // "options.allowedHosts[0] should be a non-empty string".
    //
    // Descartar as entradas inválidas e cair para 'auto' preserva a proteção
    // contra DNS rebinding, ao contrário de DANGEROUSLY_DISABLE_HOST_CHECK.
    const hosts = Array.isArray(devServerConfig.allowedHosts)
      ? devServerConfig.allowedHosts.filter(h => typeof h === 'string' && h.length > 0)
      : devServerConfig.allowedHosts;

    devServerConfig.allowedHosts =
      Array.isArray(hosts) && hosts.length === 0 ? 'auto' : hosts;

    return devServerConfig;
  },
};
