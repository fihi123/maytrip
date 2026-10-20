'use strict';
((root) => {
  const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function iso(y,m,d) { y=Number(y); m=Number(m); d=Number(d); const date=new Date(Date.UTC(y,m-1,d)); return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d ? `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` : ''; }
  function dates(text) {
    const found=[];
    const patterns=[[/\b(20\d{2})\s*[年년./-]\s*(\d{1,2})\s*[月월./-]\s*(\d{1,2})\s*[日일]?/g,m=>iso(m[1],m[2],m[3])],[/\b(\d{1,2})[\s/-]*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,/-]*(20\d{2})\b/gi,m=>iso(m[3],months[m[2].slice(0,3).toLowerCase()],m[1])],[/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s]+(\d{1,2}),?\s+(20\d{2})\b/gi,m=>iso(m[3],months[m[1].slice(0,3).toLowerCase()],m[2])]];
    for(const [regex,convert] of patterns) for(const match of text.matchAll(regex)) {const date=convert(match);if(date)found.push({date,index:match.index,end:match.index+match[0].length});}
    return found.sort((a,b)=>a.index-b.index);
  }
  function time(text) {const m=text.match(/\b(?:(AM|PM)\s*)?(\d{1,2}):([0-5]\d)\s*(AM|PM)?\b/i);if(!m)return '';let h=Number(m[2]); const ampm=(m[1]||m[4]||'').toUpperCase();if(ampm){if(h<1||h>12)return '';h=h%12+(ampm==='PM'?12:0);}return h<24?`${String(h).padStart(2,'0')}:${m[3]}`:'';}
  function parse(text,kind='auto') {
    text=String(text).replace(/\r/g,'').replace(/[\t ]+/g,' ');
    const hotel=kind==='hotel'||(kind==='auto'&&/check[ -]?in|체크인|チェックイン|숙박|hotel|ryokan/i.test(text));
    const rows=[];
    if(hotel) {
      const nameLine=text.split('\n').find(l=>/^(?:호텔명|숙소명|Hotel(?: name)?|Property(?: name)?)\s*[:：]/i.test(l));
      const name=(nameLine?nameLine.replace(/^[^:：]*[:：]\s*/,''):text.split('\n').find(l=>/호텔|료칸|hotel|ryokan|tamanoyu|tamano yu/i.test(l)&&!(/check|체크|예약번호|confirmation/i.test(l))))||'숙소';
      const labels=[['체크인',/check[ -]?in|체크인|チェックイン/i],['체크아웃',/check[ -]?out|체크아웃|チェックアウト/i]];
      labels.forEach(([label,regex])=>{const match=regex.exec(text);if(!match)return;const after=text.slice(match.index+match[0].length);const next=after.search(/check[ -]?(?:in|out)|체크인|체크아웃|チェックイン|チェックアウト/i);const block=next>=0?after.slice(0,next):after;const ds=dates(block);const date=ds[0];const clock=date?time(block.slice(date.end,date.end+65)):'';rows.push({date:date?.date||'',time:clock,name:`${name.trim().slice(0,95)} ${label}`,place:name.trim().slice(0,150),note:`숙소 예약 내역에서 인식한 ${label}. 예약 문서의 날짜·시간을 확인해 주세요.`});});
      if(!rows.length)rows.push({date:'',time:'',name:`${name.trim().slice(0,95)} 체크인`,place:name.trim().slice(0,150),note:'체크인 날짜를 찾지 못했습니다. 예약 문서를 확인해 입력해 주세요.'});
    } else {
      // Labels keep departure and arrival dates separate, including overnight flights.
      const labels=/(?:출발(?:일시|일|시간)?|도착(?:일시|일|시간)?|Departure|Arrival|Depart(?:ure)? date|Arriv(?:al)? date)\s*[:：]?/gi;
      const matches=[...text.matchAll(labels)];
      const flights=[...text.matchAll(/\b([A-Z][A-Z0-9]|\d[A-Z])\s?(\d{2,4})\b/g)].filter(m=>!['AM','PM'].includes(m[1]));
      for(let i=0;i<matches.length;i++) {
        const m=matches[i]; const block=text.slice(m.index+m[0].length,matches[i+1]?.index??text.length); const ds=dates(block);const date=ds[0];
        if(!date&&!time(block)&&!/ICN|FUK|인천|후쿠오카/i.test(block))continue;
        const arrival=/도착|arriv/i.test(m[0]);
        const nearest=flights.filter(f=>f.index<=m.index).at(-1)||flights.find(f=>f.index<m.index+block.length);
        const airports=[...block.matchAll(/\b(?:ICN|FUK|GMP|PUS|NRT|HND|KIX|CJU)\b/g)].map(x=>x[0]);
        const place=airports[0]||(/인천/.test(block)?'인천국제공항':/후쿠오카/.test(block)?'후쿠오카공항':'');
        rows.push({date:date?.date||'',time:time(block),name:`${nearest?nearest[1]+nearest[2]+' ':''}항공 ${arrival?'도착':'출발'}`,place,note:'항공 예약 내역에서 인식했습니다. 공항 현지 시각과 날짜를 확인해 주세요.'});
      }
      if(!rows.length) {
        for(let i=0;i<flights.length;i++) {
          const flight=flights[i];const block=text.slice(flight.index,flights[i+1]?.index??text.length);const ds=dates(block);const date=ds[0]; const airports=[...block.matchAll(/\b(?:ICN|FUK|GMP|PUS|NRT|HND|KIX|CJU)\b/g)].map(x=>x[0]);
          rows.push({date:date?.date||'',time:time(block),name:`${flight[1]}${flight[2]} 항공 출발`,place:airports.join(' → '),note:'표 형식 문서의 출발 후보입니다. 날짜·시간·공항을 확인해 주세요.'});
        }
      }
    }
    const unique=rows.filter((r,i,a)=>a.findIndex(x=>x.date===r.date&&x.time===r.time&&x.name===r.name&&x.place===r.place)===i);
    return unique.slice(0,40);
  }
  root.ReservationParser={parse,dates,time};
  if(typeof module!=='undefined')module.exports=root.ReservationParser;
})(typeof window!=='undefined'?window:globalThis);
