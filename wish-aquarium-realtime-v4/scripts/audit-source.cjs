const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const catalog = require('../creature-catalog.json');
const source = process.argv[2];
if (!source) throw new Error('Pass the original asset directory. Read-only audit.');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const byFolder = new Map(catalog.entries.map(e => [e.folder, e]));
const prompts = new Map(JSON.parse(fs.readFileSync(path.join(source,'video_prompts.json'),'utf8')).map(e=>[e.folder,e]));
const matrix = Array.from({length:7}, () => Array(7).fill(0));
const report = {source, catalogCount:catalog.count, validPairs:0, excludedDirectories:[], incomplete:[], anomalies:[], duplicateImages:[], duplicateVideos:[], matrix};
const images = new Map(), videos = new Map();
function group(map, key, folder) { if (!map.has(key)) map.set(key, []); map.get(key).push(folder); }
for (const dir of fs.readdirSync(source, {withFileTypes:true})) {
  if (!dir.isDirectory()) continue;
  if (dir.name.startsWith('_') || dir.name === 'diagonal_converted' || !dir.name.includes('_')) { report.excludedDirectories.push(dir.name); continue; }
  const folder = path.join(source, dir.name);
  const files = fs.readdirSync(folder);
  const pngs = files.filter(f => /\.png$/i.test(f));
  const hasVideo = files.includes('video_result.json');
  if (pngs.length !== 1 || !hasVideo) {
    report.incomplete.push({folder:dir.name, pngCount:pngs.length, hasVideoResult:hasVideo});
    continue;
  }
  try {
    const video = JSON.parse(fs.readFileSync(path.join(folder,'video_result.json'),'utf8')).video_url;
    if (new URL(video).protocol !== 'https:') throw new Error('Non-HTTPS video URL');
    const bytes = fs.readFileSync(path.join(folder,pngs[0]));
    if (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG signature');
    const sha = hash(bytes), entry = byFolder.get(dir.name);
    if (!entry) throw new Error('Complete source pair missing from catalog');
    const meta = prompts.get(dir.name);
    if (!meta || meta.wishCat !== entry.wishCategory || meta.creatureTitle !== entry.wishType || meta.methodTitle !== entry.methodType || catalog.categories[entry.situationIndex] !== meta.wishCat || !catalog.methodGroups[entry.wayIndex].includes(meta.methodTitle)) throw new Error('Source category or 7x7 mapping mismatch');
    if (entry.videoUrl !== video || entry.imageSha256 !== sha || entry.sourcePng !== pngs[0]) throw new Error('Catalog/source identity mismatch');
    report.validPairs++;
    matrix[entry.situationIndex][entry.wayIndex]++;
    group(images,sha,dir.name); group(videos,video,dir.name);
  } catch(error) { report.anomalies.push({folder:dir.name,error:error.message}); }
}
report.duplicateImages = [...images.values()].filter(v=>v.length>1);
report.duplicateVideos = [...videos.values()].filter(v=>v.length>1);
const ways = ['신뢰형','탐험형','축적형','회복형','공존형','몰입형','초월형'];
report.emptyCells = matrix.flatMap((row,i)=>row.flatMap((count,j)=>count?[]:[catalog.categories[i]+' × '+ways[j]]));
report.missingSourceDirectories = catalog.entries.filter(e=>!fs.existsSync(path.join(source,e.folder))).map(e=>e.folder);
fs.writeFileSync(path.join(root,'SOURCE-AUDIT.json'),JSON.stringify(report,null,2)+'\n');
const lines = ['# 원본 조합 자산 검증 보고서','', '검증일: 2026-10-22. 원본 폴더는 읽기만 했으며 변경하지 않았습니다.', '',
  `- 원장과 PNG SHA-256·영상 URL이 모두 일치한 결과: ${report.validPairs}쌍`,
  `- PNG 중복 그룹: ${report.duplicateImages.length}, 영상 주소 중복 그룹: ${report.duplicateVideos.length}`,
  `- 원장 불일치·이상 파일: ${report.anomalies.length}, 원본 폴더 누락: ${report.missingSourceDirectories.length}`,
  `- 결과로 사용하지 않은 미완성 조합 폴더: ${report.incomplete.length}`,
  '', '## 7×7 대분류별 실제 결과 수', '', '|소망|'+ways.join('|')+'|합계|','|---|'+ways.map(()=>'---:').join('|')+'|---:|',
  ...matrix.map((row,i)=>'|'+catalog.categories[i]+'|'+row.join('|')+'|'+row.reduce((a,b)=>a+b,0)+'|'),
  '', '0인 칸에는 임의의 대체 생물을 배정하지 않습니다. 세부유형 선택에서 실제 존재하는 조합만 결과로 연결합니다.',
  '', '## 제외한 보조 폴더', '', ...report.excludedDirectories.map(s=>'- '+s),
  '', '## PNG 또는 영상 결과가 미완성인 조합', '', '|폴더|PNG 수|video_result.json|','|---|---:|---|',
  ...report.incomplete.map(e=>`|${e.folder}|${e.pngCount}|${e.hasVideoResult?'있음':'없음'}|`),
  '', '## 이상 파일 및 중복', '', JSON.stringify({anomalies:report.anomalies,duplicateImages:report.duplicateImages,duplicateVideos:report.duplicateVideos},null,2), ''];
fs.writeFileSync(path.join(root,'SOURCE-AUDIT.md'),lines.join('\n'));
console.log(JSON.stringify({...report,incomplete:report.incomplete.length},null,2));
if (report.anomalies.length || report.missingSourceDirectories.length || report.validPairs !== catalog.count) process.exitCode = 1;
