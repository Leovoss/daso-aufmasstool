import {textReadingRotation} from './attachment-orientation';
let library:Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>|undefined;
let worker:Promise<import('pdfjs-dist/legacy/build/pdf.mjs').PDFWorker>|undefined;
const waiting:(()=>void)[]=[];let active=0;
async function slot(){if(active>=2)await new Promise<void>(resolve=>waiting.push(resolve));else active++;return()=>{const next=waiting.shift();if(next)next();else active--;};}
export async function renderPDFPreview(source:string,canvas:HTMLCanvasElement,signal:AbortSignal){
 const release=await slot();let loading:import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentLoadingTask|undefined;
 try{if(signal.aborted)return;library||=import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await library;pdf.GlobalWorkerOptions.workerSrc='/pdf-preview/pdf.worker-6.4.299.min.mjs';worker||=(async()=>{const w=pdf.PDFWorker.create({name:'daso-attachment-preview'});await w.promise;return w;})();
  const response=await fetch(source,{signal});if(!response.ok)throw Error('Datei nicht verfügbar.');const data=new Uint8Array(await response.arrayBuffer());if(signal.aborted)return;
  loading=pdf.getDocument({data,worker:await worker,cMapUrl:'/pdf-preview/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-preview/standard_fonts/',wasmUrl:'/pdf-preview/wasm/',disableAutoFetch:true});
  const abort=()=>{void loading?.destroy();};signal.addEventListener('abort',abort,{once:true});try{const doc=await loading.promise,page=await doc.getPage(1);if(signal.aborted)return;const size=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(320/size.width,210/size.height)*2});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,viewport,background:'white'}).promise;return doc.numPages;}finally{signal.removeEventListener('abort',abort);}
 }finally{await loading?.destroy().catch(()=>{});release();}
}

export async function readPDFRotations(data:ArrayBuffer,fallback:number[]){
 // In non-browser renderers the page metadata remains authoritative.
 if(typeof window==='undefined')return fallback;
 let loading:import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentLoadingTask|undefined;
 try{library||=import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await library;pdf.GlobalWorkerOptions.workerSrc='/pdf-preview/pdf.worker-6.4.299.min.mjs';worker||=(async()=>{const w=pdf.PDFWorker.create({name:'daso-attachment-preview'});await w.promise;return w;})();loading=pdf.getDocument({data:new Uint8Array(data.slice(0)),worker:await worker,cMapUrl:'/pdf-preview/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-preview/standard_fonts/',wasmUrl:'/pdf-preview/wasm/',disableAutoFetch:true});const doc=await loading.promise,rotations:number[]=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();rotations.push(textReadingRotation(content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item),fallback[i-1]??page.rotate));}return rotations;}catch{return fallback;}finally{await loading?.destroy().catch(()=>{});}
}
