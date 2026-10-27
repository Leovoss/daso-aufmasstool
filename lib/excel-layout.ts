import * as CFB from 'cfb';
import * as XLSX from 'xlsx';

type Layout={lastRow:number;totalRow:number;currentIndex:number;valueIndex:number;totalValueIndex:number};

export function invoiceExcelLayout(bytes:Uint8Array,headerRows:number[],totalRows:number[]):Uint8Array{
 const archive=CFB.read(bytes,{type:'array'}),decoder=new TextDecoder(),encoder=new TextEncoder(),read=(path:string)=>{const file=CFB.find(archive,'/'+path);if(!file)throw Error('Excel-Layout fehlt.');return decoder.decode(new Uint8Array(file.content));},write=(path:string,xml:string)=>CFB.utils.cfb_add(archive,'/'+path,encoder.encode(xml));let styles=read('xl/styles.xml');const fonts=styles.match(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/)!,fills=styles.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/)!,xfs=styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/)!,fontId=Number(fonts[1]),fillId=Number(fills[1]);
 styles=styles.replace(fonts[0],`<fonts count="${fontId+2}">${fonts[2]}<font><b/><sz val="11"/><color rgb="FF49358E"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF49358E"/><name val="Calibri"/></font></fonts>`).replace(fills[0],`<fills count="${fillId+1}">${fills[2]}<fill><patternFill patternType="solid"><fgColor rgb="FFF0EDFA"/><bgColor indexed="64"/></patternFill></fill></fills>`);
 const existing=[...xfs[2].matchAll(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m=>m[0]),added:string[]=[],cache=new Map<string,number>();let sheet=read('xl/worksheets/sheet1.xml');sheet=sheet.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g,(_m,attrs:string,_col:string,rowText:string)=>{const row=Number(rowText),base=Number(attrs.match(/\bs="(\d+)"/)?.[1]||0),kind=row===1?'title':headerRows.includes(row)?'header':totalRows.includes(row)?'total':'body',key=base+'|'+kind;let id=cache.get(key);if(id===undefined){const format=existing[base]?.match(/\bnumFmtId="(\d+)"/)?.[1]||'0';id=existing.length+added.length;added.push(`<xf numFmtId="${format}" fontId="${kind==='title'?fontId+1:kind==='body'?0:fontId}" fillId="${kind==='header'?fillId:0}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1" applyNumberFormat="1"><alignment vertical="center" wrapText="1"/></xf>`);cache.set(key,id);}return '<c'+attrs.replace(/\s+s="\d+"/g,'')+` s="${id}">`;});
 styles=styles.replace(xfs[0],`<cellXfs count="${existing.length+added.length}">${xfs[2]}${added.join('')}</cellXfs>`);sheet=sheet.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,'<sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>').replace(/(<worksheet\b[^>]*>)/,'$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>').replace('</worksheet>','<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>');write('xl/styles.xml',styles);write('xl/worksheets/sheet1.xml',sheet);return new Uint8Array(CFB.write(archive,{type:'array',fileType:'zip',compression:true}));
}

// SheetJS CE writes values and formats. Add the native Excel layout to that
// generated archive so rotated headings and print settings survive export.
export function compactExcelLayout(bytes:Uint8Array,layout:Layout):Uint8Array{
 const archive=CFB.read(bytes,{type:'array'}),decoder=new TextDecoder(),encoder=new TextEncoder();
 const read=(path:string)=>{const file=CFB.find(archive,'/'+path);if(!file)throw Error('Excel-Layout konnte nicht erstellt werden.');return decoder.decode(new Uint8Array(file.content));};
 const write=(path:string,xml:string)=>CFB.utils.cfb_add(archive,'/'+path,encoder.encode(xml));
 let styles=read('xl/styles.xml');
 const fonts=styles.match(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/),fills=styles.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/),borders=styles.match(/<borders count="(\d+)">([\s\S]*?)<\/borders>/),xfs=styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
 if(!fonts||!fills||!borders||!xfs)throw Error('Excel-Formatvorlage fehlt.');
 const boldFont=Number(fonts[1]),titleFont=boldFont+1,fill=Number(fills[1]),border=Number(borders[1]);
 styles=styles.replace(fonts[0],`<fonts count="${boldFont+2}">${fonts[2].replace('<sz val="12"/>','<sz val="11"/>')}<font><b/><sz val="11"/><color rgb="FF49358E"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF49358E"/><name val="Calibri"/></font></fonts>`);
 styles=styles.replace(fills[0],`<fills count="${fill+1}">${fills[2]}<fill><patternFill patternType="solid"><fgColor rgb="FFF0EDFA"/><bgColor indexed="64"/></patternFill></fill></fills>`);
 styles=styles.replace(borders[0],`<borders count="${border+1}">${borders[2]}<border><left/><right/><top style="thin"><color rgb="FFD9D1EB"/></top><bottom style="thin"><color rgb="FFD9D1EB"/></bottom><diagonal/></border></borders>`);
 const formats=[...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)],format=(code:string)=>Number(formats.find(m=>m[2].replaceAll('&quot;','"')===code)?.[1]||0),currency=format('#,##0.00 "€"'),quantity=format('#,##0.00')||4;
 const first=Number(xfs[1]),definitions:string[]=[],add=(font:number,numberFormat:number,alignment:string,fillId=0,borderId=0)=>{definitions.push(`<xf numFmtId="${numberFormat}" fontId="${font}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${alignment}/></xf>`);return first+definitions.length-1;};
 const body=add(0,0,'vertical="center"'),description=add(0,0,'vertical="center" wrapText="1"'),amount=add(0,currency,'horizontal="right" vertical="center"'),mass=add(0,quantity,'horizontal="right" vertical="center"'),cumulative=add(boldFont,quantity,'horizontal="right" vertical="center"'),header=add(boldFont,0,'horizontal="center" vertical="center" wrapText="1"',fill,border),rotated=add(boldFont,0,'horizontal="center" vertical="center" textRotation="90"',fill,border),title=add(titleFont,0,'vertical="center"'),metadata=add(boldFont,0,'vertical="center"'),totalAmount=add(boldFont,currency,'horizontal="right" vertical="center"',0,border),totalLabel=add(boldFont,0,'vertical="center"',0,border);
 styles=styles.replace(xfs[0],`<cellXfs count="${first+definitions.length}">${xfs[2]}${definitions.join('')}</cellXfs>`);write('xl/styles.xml',styles);
 let sheet=read('xl/worksheets/sheet1.xml');
 sheet=sheet.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g,(_match,attributes:string,column:string,rowText:string)=>{
  const col=XLSX.utils.decode_col(column),row=Number(rowText);let style=body;
  if(row===1)style=title;
  else if(row<6&&col===0)style=metadata;
  else if(row===6)style=col>=5&&col<=layout.currentIndex?rotated:header;
  else if(row>=7&&row<=layout.lastRow)style=col===1?description:col===2?cumulative:col===4||col>=layout.valueIndex?amount:col>=5?mass:body;
  else if(row===layout.totalRow)style=col>=layout.valueIndex?totalAmount:totalLabel;
  return '<c'+attributes.replace(/\s+s="\d+"/g,'')+' s="'+style+'">';
 });
 sheet=sheet.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,'<sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="6" topLeftCell="D7" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>');
 sheet=sheet.replace(/(<worksheet\b[^>]*>)/,'$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
 const pageSetup='<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
 sheet=sheet.includes('<ignoredErrors>')?sheet.replace('<ignoredErrors>',pageSetup+'<ignoredErrors>'):sheet.replace('</worksheet>',pageSetup+'</worksheet>');
 write('xl/worksheets/sheet1.xml',sheet);
 return new Uint8Array(CFB.write(archive,{type:'array',fileType:'zip',compression:true}));
}
