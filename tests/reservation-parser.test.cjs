const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,dates,time}=require('../reservation-parser.js');
test('호텔 체크인과 체크아웃을 별도 날짜로 인식',()=>{
  const rows=parse('Hotel name: Yufuin Tamanoyu\nCheck-in: 2027-05-14 15:00\nCheck-out: 2027-05-15 11:00');
  assert.equal(rows.length,2);assert.equal(rows[0].date,'2027-05-14');assert.equal(rows[0].time,'15:00');assert.equal(rows[1].date,'2027-05-15');assert.equal(rows[1].time,'11:00');assert.match(rows[0].name,/Yufuin Tamanoyu/);
});
test('영문 날짜 및 오전 오후 시간을 인식',()=>{const rows=parse('Hotel: Test Inn\nCheck-in: May 13, 2027 3:00 PM\nCheck-out: 16 May 2027 10:00 AM');assert.equal(rows[0].date,'2027-05-13');assert.equal(rows[0].time,'15:00');assert.equal(rows[1].date,'2027-05-16');assert.equal(time('12:00 AM'),'00:00');});
test('자정 넘는 항공편은 출발·도착 날짜를 분리',()=>{const rows=parse('KE123\nDeparture: ICN 2027-05-13 23:00\nArrival: FUK 2027-05-14 01:00','flight');assert.equal(rows.length,2);assert.equal(rows[0].date,'2027-05-13');assert.equal(rows[1].date,'2027-05-14');assert.equal(rows[1].time,'01:00');assert.equal(rows[1].place,'FUK');});
test('날짜가 없으면 오늘 날짜나 여행 날짜로 추측하지 않음',()=>{const rows=parse('호텔명: 테스트 호텔\n체크인: 오후\n체크아웃: 오전','hotel');assert.equal(rows[0].date,'');assert.equal(rows[0].time,'');});
test('존재하지 않는 날짜 및 시각은 제외',()=>{assert.deepEqual(dates('2027-02-30'),[]);assert.equal(time('29:00'),'');});
test('전자항공권의 붙여 쓴 영문 날짜 지원',()=>{assert.equal(dates('13MAY2027')[0].date,'2027-05-13');});
test('같은 승객 여정이 반복되어도 후보 중복 제거',()=>{const rows=parse('KE123\nDeparture: ICN 2027-05-13 09:00\nKE123\nDeparture: ICN 2027-05-13 09:00','flight');assert.equal(rows.length,1);});
