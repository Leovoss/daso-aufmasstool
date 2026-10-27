import {createRequire} from 'node:module';
import {mkdir,copyFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),tesseract=dirname(require.resolve('tesseract.js/package.json')),core=dirname(createRequire(join(tesseract,'package.json')).resolve('tesseract.js-core/package.json')),osd=require('@tesseract.js-data/osd');
const target=fileURLToPath(new URL('../public/attachment-ocr/',import.meta.url));await mkdir(target,{recursive:true});
for(const [source,name] of [[join(tesseract,'dist/worker.min.js'),'worker.min.js'],[join(core,'tesseract-core.wasm.js'),'tesseract-core.wasm.js'],[join(core,'tesseract-core.wasm'),'tesseract-core.wasm'],[join(osd.langPath,'osd.traineddata.gz'),'osd.traineddata.gz'],[join(tesseract,'LICENSE.md'),'LICENSE-tesseract.js'],[join(core,'LICENSE'),'LICENSE-core']])await copyFile(source,join(target,name));
