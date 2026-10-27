import {PDFDocument,degrees} from 'pdf-lib';
import {detectedRotation,jpegOrientation,normalizeRotation,textReadingRotation} from './attachment-orientation';

export type OrientationReview={preview:string;page:number;pages:number};
export type PreparedAttachment={file:File;original?:File;normalized:boolean};
export function orientableAttachment(file:Pick<File,'type'|'name'>){return file.type==='application/pdf'||/\.pdf$/i.test(file.name)||/^image\/(jpeg|png|webp|avif)$/.test(file.type);}
export async function prepareAttachment(file:File,options:{signal:AbortSignal;progress:(text:string)=>void;review:(page:OrientationReview)=>Promise<number>}):Promise<PreparedAttachment>{
 if(!orientableAttachment(file))return{file,normalized:false};
 if(!file.size||file.size>20*1024*1024)throw Error('Die Anlage muss zwischen 1 Byte und 20 MB groß sein.');
 const {signal,progress,review}=options,check=()=>{if(signal.aborted)throw Error('Ausrichten abgebrochen. Die Anlage wurde nicht hochgeladen.');};
 let ocr:import('tesseract.js').Worker|undefined;
 async function wait<T>(promise:Promise<T>):Promise<T>{check();let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};try{return await Promise.race([promise,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(Error('Textrichtung nicht sicher ermittelt.')),40000);abort=()=>reject(Error('Ausrichten abgebrochen.'));signal.addEventListener('abort',abort,{once:true});})]);}finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);}}
 async function detect(canvas:HTMLCanvasElement){try{
  if(!ocr){const {createWorker}=await import('tesseract.js'),path=(name:string)=>new URL('/attachment-ocr/'+name,window.location.href).href;
   const starting=createWorker('osd',0,{workerPath:path('worker.min.js'),corePath:path('tesseract-core.wasm.js'),langPath:new URL('/attachment-ocr/',window.location.href).href,legacyCore:true,legacyLang:true,gzip:true,cacheMethod:'none',workerBlobURL:false,logger:()=>{},errorHandler:()=>{}});
   try{ocr=await wait(starting);}catch(error){void starting.then(w=>w.terminate()).catch(()=>{});throw error;}
  }
  const result=await wait(ocr.detect(canvas));check();return detectedRotation(result.data);
 }catch{if(ocr){void ocr.terminate();ocr=undefined;}check();return null;}}
 async function direction(canvas:HTMLCanvasElement,page:number,pages:number){progress(`Textrichtung wird geprüft · Seite ${page} von ${pages}`);const automatic=await detect(canvas);check();if(automatic!==null)return automatic;return normalizeRotation(await review({preview:canvas.toDataURL('image/png'),page,pages}));}
 function canvas(width:number,height:number){const c=document.createElement('canvas');c.width=Math.ceil(width);c.height=Math.ceil(height);return c;}
 try{
  check();progress('Anlage wird geöffnet und ausgerichtet …');const bytes=await file.arrayBuffer();check();
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
   const output=await PDFDocument.load(bytes),pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');pdf.GlobalWorkerOptions.workerSrc='/pdf-preview/pdf.worker-6.4.299.min.mjs';
   const worker=pdf.PDFWorker.create({name:'daso-upload-orientation'});await worker.promise;
   const loading=pdf.getDocument({data:new Uint8Array(bytes.slice(0)),worker,cMapUrl:'/pdf-preview/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-preview/standard_fonts/',wasmUrl:'/pdf-preview/wasm/',disableAutoFetch:true});let changed=false;
   try{const doc=await loading.promise;for(let i=1;i<=doc.numPages;i++){
    check();progress(`Anlage wird ausgerichtet · Seite ${i} von ${doc.numPages}`);const page=await doc.getPage(i),content=await page.getTextContent(),fallback=normalizeRotation(output.getPage(i-1).getRotation().angle);
    let rotation=textReadingRotation(content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item),-1);
    if(rotation===-1){const size=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1800/size.width,1800/size.height,3)}),preview=canvas(viewport.width,viewport.height);await page.render({canvas:preview,viewport,background:'white'}).promise;rotation=normalizeRotation(page.rotate+await direction(preview,i,doc.numPages));preview.width=preview.height=1;}
    check();if(rotation!==fallback){output.getPage(i-1).setRotation(degrees(rotation));changed=true;}page.cleanup();
   }}finally{await loading.destroy().catch(()=>{});worker.destroy();}
   if(!changed)return{file,normalized:true};
   const rotated=new File([new Uint8Array(await output.save())],file.name,{type:'application/pdf',lastModified:file.lastModified});return{file:rotated,original:file,normalized:true};
  }
  // Browsers apply the camera's EXIF orientation when decoding. Re-encoding
  // removes that tag, so the export cannot rotate the same photo a second time.
  const image=await createImageBitmap(file);try{
   if(image.width*image.height>40_000_000)throw Error('Das Bild ist zu groß für die Ausrichtung. Bitte auf höchstens 40 Megapixel verkleinern.');
   const scale=Math.min(1,1800/image.width,1800/image.height),preview=canvas(image.width*scale,image.height*scale),p=preview.getContext('2d')!;p.fillStyle='white';p.fillRect(0,0,preview.width,preview.height);p.drawImage(image,0,0,preview.width,preview.height);
   const rotation=await direction(preview,1,1);preview.width=preview.height=1;check();
   if(rotation===0&&file.type!=='image/webp'&&file.type!=='image/avif'&&(file.type!=='image/jpeg'||jpegOrientation(bytes)===1))return{file,normalized:true};
   const swapped=rotation===90||rotation===270,out=canvas(swapped?image.height:image.width,swapped?image.width:image.height),ctx=out.getContext('2d')!;
   ctx.translate(out.width/2,out.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(image,-image.width/2,-image.height/2);
   const mime=file.type==='image/jpeg'?'image/jpeg':'image/png',blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(value=>value?resolve(value):reject(Error('Bild konnte nicht ausgerichtet werden.')),mime,.97));out.width=out.height=1;check();
   return{file:new File([blob],mime==='image/png'?file.name.replace(/\.[^.]+$/,'.png'):file.name,{type:mime,lastModified:file.lastModified}),original:file,normalized:true};
  }finally{image.close();}
 }finally{if(ocr)await ocr.terminate().catch(()=>{});}
}
