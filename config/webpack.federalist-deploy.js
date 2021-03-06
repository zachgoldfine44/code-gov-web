/**
 * @author: @AngularClass
 */
const helpers = require('./helpers');
const ghDeploy = require('./github-deploy');
const CreateFilePlugin = require('webpack-create-file-plugin');
const CriticalCssPlugin = require('./critical-css-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const PreloadWebpackPlugin = require('preload-webpack-plugin');
const webpackMerge = require('webpack-merge'); // used to merge webpack configs
const ghpages = require('gh-pages');
const webpack = require('webpack');
const RobotstxtPlugin = require('robotstxt-webpack-plugin').default;
const webpackConfig = ghDeploy.getWebpackConfigModule();
const commonConfig = require('./webpack.common.js');

const postcssCssnext = require('postcss-cssnext');
const postcssImport = require('postcss-import');

const SiteConfig = require('./code-gov-config.json');

/**
 * Webpack Constants
 */
const GIT_REMOTE_NAME = process.env.GIT_REMOTE_NAME || 'origin';
console.log("GIT_REMOTE_NAME:", GIT_REMOTE_NAME);
const COMMIT_MESSAGE = 'Updates';
const GH_REPO_NAME = ghDeploy.getRepoName(GIT_REMOTE_NAME);
console.log("GH_REPO_NAME:", GH_REPO_NAME);
const ENV = 'production';
let BASEURL;
let gtmAuth;
let GIT_BRANCH_NAME;
let robotsTxtConf = {
  policy: [
    {
      userAgent: '*',
      disallow: '/'
    }
  ],
  host: 'https://staging.code.gov'
};

if (helpers.hasProcessFlag('federalist-stag')){
  GIT_BRANCH_NAME = 'federalist-stag';
  BASEURL = '/';
  gtmAuth = 'GTM-M9L9Q5';

} else if (helpers.hasProcessFlag('dashboard-preview')){
  GIT_BRANCH_NAME = 'federalist-dashboard-preview';
  BASEURL = '/preview/gsa/code-gov-web/'+GIT_BRANCH_NAME+'/';
  gtmAuth = 'GTM-M9L9Q5';

} else if (helpers.hasProcessFlag('federalist-prod')){
  GIT_BRANCH_NAME = 'federalist-prod';
  BASEURL = '/';
  gtmAuth = 'GTM-M9L9Q5';
  robotsTxtConf.policy = [{
    userAgent: '*',
    allow: '/'
  }];
  robotsTxtConf.host = 'https://code.gov';
} else {
  GIT_BRANCH_NAME = process.env.GIT_BRANCH_NAME || 'federalist-dev';
  BASEURL = `/preview/gsa/code-gov-web/${GIT_BRANCH_NAME}/`;
  gtmAuth = 'GTM-M9L9Q5';
}

const METADATA = webpackMerge(webpackConfig.metadata, {
  /**
   * Prefixing the REPO name to the baseUrl for router support.
   * This also means all resource URIs (CSS/Images/JS) will have this prefix added by the browser
   * unless they are absolute (start with '/'). We will handle it via `output.publicPath`
   */
  baseUrl: BASEURL,
  ENV: ENV,
  gtmAuth: gtmAuth,
  HMR: false,
  isDevServer: false,
});

module.exports = function (env) {

  const htmlWebpackPlugin = new HtmlWebpackPlugin(Object.assign({
    metadata: METADATA,
    template: 'src/index.html',
    chunksSortMode: 'dependency',
    inject: 'head'
  }, SiteConfig));


  return webpackMerge(webpackConfig({env: ENV}), {

    output: {
      publicPath: BASEURL
    },

    plugins: [

     htmlWebpackPlugin,

     new PreloadWebpackPlugin(),

      new LoaderOptionsPlugin({
        options: {
          postcss: [
            postcssImport({ addDependencyTo: webpack }),
            postcssCssnext({
              browsers: ['last 2 versions', 'ie >= 9'],
            }),
          ],
          sassLoader: {
            includePaths: [
              require('bourbon').includePaths,
              require('bourbon-neat').includePaths
            ]
          }
        }
      }),

      new CriticalCssPlugin({
        src: 'index.html'
      }),

      new CreateFilePlugin({
        files: [
          '.nojekyll'
        ]
      }),

      new RobotstxtPlugin(robotsTxtConf),

      function() {
        this.plugin('done', function() {
          console.log('Starting deployment to GitHub.');

          const logger = function (msg) {
            console.log(msg);
          };

          const options = {
            logger: logger,
            branch: GIT_BRANCH_NAME,
            remote: GIT_REMOTE_NAME,
            message: COMMIT_MESSAGE,
            dotfiles: true
          };

          const outputPath = webpackConfig({env: ENV}).output.path;
          console.log("outputPath:", outputPath);

          ghpages.publish(outputPath, options, function(err) {
            if (err) {
              console.log('GitHub deployment done. STATUS: ERROR: '+err);
              throw err;
            } else {
              if (BASEURL && BASEURL.length > 3) {
                console.log("Deployed to https://federalist-proxy.app.cloud.gov/" + BASEURL);
              }
              console.log('GitHub deployment done. STATUS: SUCCESS.');
            }
          });
        })
      }
    ]
  });
}
