// Small dependency-free ZIP writer (stored entries, no compression).
// The ZIP contains UTF-8 CSV files so one click preserves all log types.
export function zipFiles(files){
 const encoder=new TextEncoder(),chunks=[],central=[];
 let offset=0;
 const crcTable=new Uint32Array(256);
 for(let n=0;n<256;n++){
  let c=n;
  for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;
  crcTable[n]=c>>>0;
 }
 const crc32=bytes=>{
  let c=0xffffffff;
  for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
 };
 for(const [name,content] of files){
  const filename=encoder.encode(name),data=encoder.encode(content);
  const size=data.length,checksum=crc32(data);
  const local=new Uint8Array(30+filename.length),a=new DataView(local.buffer);
  a.setUint32(0,0x04034b50,true);
  a.setUint16(4,20,true);a.setUint16(6,0x0800,true);
  a.setUint32(14,checksum,true);
  a.setUint32(18,size,true);a.setUint32(22,size,true);
  a.setUint16(26,filename.length,true);
  local.set(filename,30);
  chunks.push(local,data);
  const directory=new Uint8Array(46+filename.length),b=new DataView(directory.buffer);
  b.setUint32(0,0x02014b50,true);
  b.setUint16(4,20,true);b.setUint16(6,20,true);
  b.setUint16(8,0x0800,true);
  b.setUint32(16,checksum,true);
  b.setUint32(20,size,true);b.setUint32(24,size,true);
  b.setUint16(28,filename.length,true);
  b.setUint32(42,offset,true);directory.set(filename,46);
  central.push(directory);
  offset+=local.length+size;
 }
 const centralOffset=offset;
 for(const part of central){chunks.push(part);offset+=part.length;}
 const end=new Uint8Array(22),v=new DataView(end.buffer);
 v.setUint32(0,0x06054b50,true);
 v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);
 v.setUint32(12,offset-centralOffset,true);
 v.setUint32(16,centralOffset,true);
 chunks.push(end);
 return new Blob(chunks,{type:'application/zip'});
}
