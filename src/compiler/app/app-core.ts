import { BuildConditionals, BuildCtx, CompilerCtx, Config } from '../../declarations';
import { buildCoreContent } from './build-core-content';
import { generatePreamble, pathJoin } from '../util';
import { getAppCorePolyfills } from './app-polyfills';
import { getAppDistDir, getAppPublicPath, getAppWWWBuildDir, getCoreFilename } from './app-file-naming';


export async function generateCore(config: Config, compilerCtx: CompilerCtx, buildCtx: BuildCtx, globalJsContent: string, buildConditionals: BuildConditionals) {
  // mega-minify the core w/ property renaming, but not the user's globals
  // hardcode which features should and should not go in the core builds
  // process the transpiled code by removing unused code and minify when configured to do so
  let jsContent = await config.sys.getClientCoreFile({ staticName: 'core.build.js' });

  jsContent = await buildCoreContent(config, compilerCtx, buildCtx, buildConditionals, jsContent);

  if (globalJsContent) {
    // we've got global js to put in the core build too
    // concat the global js and transpiled code together
    jsContent = `${globalJsContent}\n${jsContent}`;
  }

  // wrap the core js code together
  jsContent = wrapCoreJs(config, jsContent);

  if (buildConditionals.polyfills) {
    // this build wants polyfills so let's
    // add the polyfills to the top of the core content
    // the polyfilled code is already es5/minified ready to go
    const polyfillsContent = await getAppCorePolyfills(config);
    jsContent = polyfillsContent + '\n' + jsContent;
  }

  const coreFilename = getCoreFilename(config, buildConditionals.coreId, jsContent);

  // update the app core filename within the content
  jsContent = jsContent.replace(APP_NAMESPACE_PLACEHOLDER, config.fsNamespace);

  if (config.outputTargets['www']) {
    // write the www/build/ app core file
    const appCoreWWW = pathJoin(config, getAppWWWBuildDir(config), coreFilename);
    await compilerCtx.fs.writeFile(appCoreWWW, jsContent);
  }

  if (config.outputTargets['distribution']) {
    // write the dist/ app core file
    const appCoreDist = pathJoin(config, getAppDistDir(config), coreFilename);
    await compilerCtx.fs.writeFile(appCoreDist, jsContent);
  }

  return coreFilename;
}


export function wrapCoreJs(config: Config, jsContent: string) {
  const publicPath = getAppPublicPath(config);

  const output = [
    generatePreamble(config) + '\n',
    `(function(Context,appNamespace,hydratedCssClass,publicPath){`,
    `"use strict";\n`,
    `var s=document.querySelector("script[data-namespace='${APP_NAMESPACE_PLACEHOLDER}']");`,
    `if(s){publicPath=s.getAttribute('data-path');}\n`,
    jsContent.trim(),
    `\n})({},"${config.namespace}","${config.hydratedCssClass}","${publicPath}");`
  ].join('');

  return output;
}


export const APP_NAMESPACE_PLACEHOLDER = '__APPNAMESPACE__';
