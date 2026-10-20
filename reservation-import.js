'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const start = Date.UTC(2027,4,13);
  let candidates = [];
  let busy = false;
  let worker = null;
  let pdfPromise = null;
  let ocrPromise = null;
  function status(text) { $('reservation-status').textContent = text; }
  function setBusy(value) {
    busy=value;
    for(const id of ['reservation-file','reservation-kind','parse-reservation-text','apply-reservations']) $(id).disabled=value;
  }
  function tripDay(date) {
    if(!/^2027-\d{2}-\d{2}$/.test(date))return 0;
    const [y,m,d]=date.split('-').map(Number); const iso=ReservationParser.dates(date)[0];
    if(!iso||iso.date!==date)return 0;
    const day=(Date.UTC(y,m-1,d)-start)/86400000+1;return day>=1&&day<=4?day:0;
  }
  function signature(e) { return [e.day,e.time,e.name.trim().toLowerCase(),e.place.trim().toLowerCase()].join('|'); }
  async function getPdf() {
    if(!pdfPromise) pdfPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';return lib;}).catch(error=>{pdfPromise=null;throw error;});
    return pdfPromise;
  }
  async function getOcr() {
    if(!ocrPromise)ocrPromise=(async()=>{
      if(!window.Tesseract) await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('인식 도구를 다운로드하지 못했습니다. 인터넷 연결을 확인해 주세요.'));};document.head.append(script);});
      return Tesseract.createWorker('kor+eng',1,{logger:m=>{if(m.status==='recognizing text') status(`글자 인식 중… ${Math.round(m.progress*100)}%`);}});
    })().then(value=>{worker=value;return value;}).catch(error=>{ocrPromise=null;throw error;});
    return ocrPromise;
  }
  async function recognize(image) {const ocr=await getOcr();const result=await ocr.recognize(image);return result.data.text;}
  async function imageText(file) {
    const bitmap=await createImageBitmap(file);
    try {
      if(bitmap.width*bitmap.height>40000000)throw new Error('이미지가 너무 큽니다. 예약 내용 부분만 잘라 다시 올려 주세요.');
      const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return await recognize(canvas);
    } finally {bitmap.close();}
  }
  async function pdfText(file) {
    const lib=await getPdf();const loading=lib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false});let pdf;
    try {
      pdf=await loading.promise;
      if(pdf.numPages>6)throw new Error('PDF가 6페이지를 넘습니다. 예약 내역 페이지만 나누어 올려 주세요.');
      const parts=[];
      for(let n=1;n<=pdf.numPages;n++) {
        status(`${file.name} · ${n}/${pdf.numPages}페이지 읽는 중…`);
        const page=await pdf.getPage(n);const content=await page.getTextContent();let text='';let y=null;
        for(const item of content.items) {if(!('str' in item))continue;const nextY=Math.round(item.transform[5]);if(y!==null&&Math.abs(nextY-y)>4)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');y=nextY;}
        if(text.replace(/\s/g,'').length<40) {
          const base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(base.width,base.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text=await recognize(canvas);canvas.width=canvas.height=0;
        }
        parts.push(text);page.cleanup();
      }
      return parts.join('\n--- MAYTRIP DOCUMENT ---\n');
    } finally {await loading.destroy();}
  }
  function input(label,type,value,maxLength) {
    const wrap=document.createElement('label');wrap.textContent=label;const field=document.createElement('input');field.type=type;field.value=value;
    if(maxLength)field.maxLength=maxLength;wrap.append(field);return {wrap,field};
  }
  function preview(rows) {
    candidates=[];$('reservation-results').replaceChildren();
    for(const row of rows) {
      const card=document.createElement('div');card.className='reservation-candidate';const include=document.createElement('input');include.type='checkbox';include.checked=Boolean(tripDay(row.date));
      const title=document.createElement('label');title.className='candidate-toggle';title.append(include,document.createTextNode('이 일정을 추가'));card.append(title);
      const grid=document.createElement('div');grid.className='candidate-grid';
      const date=input('날짜','date',row.date);const time=input('시간 · 공항 현지 시각','time',row.time);const name=input('일정 이름','text',row.name,120);const place=input('장소','text',row.place,150);
      const note=input('메모','text',row.note,2000);note.wrap.className='candidate-wide';
      for(const item of [date,time,name,place,note])grid.append(item.wrap);
      const warning=document.createElement('p');warning.className='reservation-warning';warning.setAttribute('role','status');
      const update=()=>{const d=tripDay(date.field.value);warning.textContent=!date.field.value?'날짜를 찾지 못했습니다. 문서의 연도·월·일을 입력하세요.':!d?'여행 기간(2027.05.13~05.16) 밖의 날짜입니다. 날짜를 확인하세요.':!time.field.value?'시간을 찾지 못했습니다. 입력하거나 시간 미정으로 추가할 수 있습니다.':'';};
      date.field.addEventListener('change',update);time.field.addEventListener('change',update);update();
      card.append(grid,warning);$('reservation-results').append(card);candidates.push({include,date:date.field,time:time.field,name:name.field,place:place.field,note:note.field});
    }
    $('apply-reservations').hidden=!rows.length;
  }
  function parseText() {
    const text=$('reservation-text').value;
    if(!text.trim()){preview([]);status('파일을 선택하거나 예약 내용을 붙여넣어 주세요.');return;}
    const rows=text.split('\n--- MAYTRIP DOCUMENT ---\n').flatMap(part=>ReservationParser.parse(part,$('reservation-kind').value)).slice(0,40);preview(rows);
    status(rows.length?`${rows.length}개의 일정 후보를 찾았습니다. 원본과 날짜·시간·장소를 비교한 뒤 선택한 일정을 추가하세요.`:'일정 정보를 찾지 못했습니다. 문서 종류를 선택하거나 인식한 텍스트에 출발·도착 또는 체크인·체크아웃과 연도 포함 날짜가 있는지 확인해 주세요.');
    $('reservation-text-panel').open=!rows.length;
  }
  $('open-reservation').addEventListener('click',()=>$('reservation-dialog').showModal());
  $('close-reservation').addEventListener('click',()=>{if(!busy)$('reservation-dialog').close();else status('인식 중입니다. 완료 후 닫을 수 있습니다.');});
  $('reservation-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('parse-reservation-text').addEventListener('click',parseText);
  $('reservation-file').addEventListener('change',async event=>{
    const files=Array.from(event.target.files);if(!files.length)return;
    preview([]);$('reservation-text').value='';
    if(files.length>4){status('파일은 한 번에 최대 4개까지 선택해 주세요.');event.target.value='';return;}
    setBusy(true);const parts=[];const errors=[];
    try {
      for(const file of files) {
        try {
          if(file.size>15*1024*1024)throw new Error('파일당 최대 15MB입니다.');
          status(`${file.name} 읽는 중…`);
          if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))parts.push(await pdfText(file));
          else if(/^image\/(png|jpeg|webp)$/.test(file.type))parts.push(await imageText(file));
          else throw new Error('PDF 또는 JPG·PNG·WEBP 파일을 선택해 주세요.');
        } catch(error){errors.push(`${file.name}: ${error.name==='PasswordException'?'암호가 없는 PDF로 저장한 뒤 다시 올려 주세요.':error.message}`);}
      }
      const text=parts.join('\n--- MAYTRIP DOCUMENT ---\n');
      if(text.length>80000){status('문서의 텍스트가 너무 많습니다. 예약 내역 페이지만 나누어 올려 주세요.');return;}
      $('reservation-text').value=text;
      if(text.trim())parseText();else status('문서를 읽지 못했습니다. 선명한 이미지 또는 텍스트 PDF로 다시 시도하거나 예약 내용을 직접 붙여넣어 주세요.');
      if(errors.length)status($('reservation-status').textContent+'\n'+errors.join('\n'));
    } finally {
      setBusy(false);event.target.value='';
      if(worker){try { await worker.terminate(); } finally { worker=null;ocrPromise=null; }}
    }
  });
  $('reservation-review').addEventListener('submit',event=>{
    event.preventDefault();const selected=candidates.filter(c=>c.include.checked);
    if(!selected.length){status('추가할 일정을 선택해 주세요.');return;}
    const added=[];const seen=new Set(window.maytrip.getEvents().map(signature));let duplicates=0;
    for(const row of selected) {
      const day=tripDay(row.date.value);
      if(!day||!row.name.value.trim()||!row.date.checkValidity()||!row.time.checkValidity()){status('선택한 항목의 이름과 날짜를 확인해 주세요. 여행 기간 안의 날짜만 추가할 수 있습니다.');return;}
      const item={id:crypto.randomUUID(),day,time:row.time.value,name:row.name.value.trim(),place:row.place.value.trim(),note:row.note.value.trim(),status:'예정'};
      const key=signature(item);if(seen.has(key)){duplicates++;continue;}seen.add(key);added.push(item);
    }
    if(!added.length){status('선택한 일정이 모두 이미 등록되어 있습니다. 날짜·시간·이름·장소가 같으면 중복으로 추가하지 않습니다.');return;}
    if(!window.maytrip.setEvents([...window.maytrip.getEvents(),...added])){status('저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요. 일정은 최대 500개까지 등록할 수 있습니다.');return;}
    window.dispatchEvent(new Event('maytrip-render'));
    status(`${added.length}개 일정을 추가했습니다.${duplicates?` 중복 ${duplicates}개는 제외했습니다.`:''} 일정 탭에서 확인하고 예약 확정 여부를 변경해 주세요.`);
    preview([]);
  });
})();
