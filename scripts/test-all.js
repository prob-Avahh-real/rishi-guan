#!/usr/bin/env node
/**
 * 日食观 · 全量测试
 * 运行: node scripts/test-all.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, detail) { failed++; console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`); }
function section(title) { console.log(`\n── ${title} ──`); }

// ==================== 核心算法 (与 index.html 同步) ====================
const ECLIPSES = [
  { id: '2026-02-17', name: '2026 环食 · 南极', type: 'annular', date: '2026-02-17T09:13:00Z', magnitude: 0.963, pathWidthKm: 120, penUmbraKm: 2800, path: [[-58, 165], [-61, 152], [-63, 140], [-65, 128]] },
  { id: '2026-08-12', name: '2026 全食 · 北极', type: 'total', date: '2026-08-12T17:47:00Z', magnitude: 1.039, pathWidthKm: 294, penUmbraKm: 4200, path: [[72, -55], [68, -40], [65.4, -25.2], [58, -12], [48, -5], [40, 0], [30, 3]] },
  { id: '2027-02-06', name: '2027 环食 · 南美', type: 'annular', date: '2027-02-06T12:30:00Z', magnitude: 0.928, pathWidthKm: 210, penUmbraKm: 3200, path: [[-12, -82], [-25, -72], [-38, -65], [-48, -58], [-55, -52]] },
  { id: '2027-08-02', name: '2027 全食 · 地中海', type: 'total', date: '2027-08-02T10:07:00Z', magnitude: 1.079, pathWidthKm: 258, penUmbraKm: 4000, path: [[28, -16], [34, -8], [40.9, 22.2], [38, 32], [32, 38], [25, 42]] },
  { id: '2028-01-26', name: '2028 环食 · 南美', type: 'annular', date: '2028-01-26T15:08:00Z', magnitude: 0.921, pathWidthKm: 240, penUmbraKm: 3400, path: [[10, -85], [0, -78], [-10, -68], [-20, -58], [-30, -48], [-38, -40]] },
  { id: '2028-07-22', name: '2028 全食 · 澳新', type: 'total', date: '2028-07-22T02:56:00Z', magnitude: 1.057, pathWidthKm: 272, penUmbraKm: 3800, path: [[-12, 130], [-22, 140], [-32, 150], [-42, 165], [-48, 172], [-52, 175]] },
  { id: '2030-06-01', name: '2030 环食 · 地中海', type: 'annular', date: '2030-06-01T06:45:00Z', magnitude: 0.944, pathWidthKm: 230, penUmbraKm: 3600, path: [[28, 5], [34, 12], [38, 20], [40, 28], [38, 36], [32, 42]] },
  { id: '2031-11-14', name: '2031 全食 · 中美', type: 'total', date: '2031-11-14T21:07:00Z', magnitude: 1.047, pathWidthKm: 280, penUmbraKm: 4100, path: [[8, -85], [12, -82], [15, -78], [18, -74], [22, -70], [28, -65]] },
];
const TYPE_CN = { total: '全食', annular: '环食', partial: '偏食', none: '不可见' };
const R_EARTH = 6371;
const DEG = Math.PI / 180;

function toRad(d) { return d * DEG; }
function haversineKm(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1), p2 = toRad(lat2), dp = toRad(lat2 - lat1), dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}
function bearing(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1), p2 = toRad(lat2), dl = toRad(lon2 - lon1);
  return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
}
function crossTrackKm(lat, lon, latA, lonA, latB, lonB) {
  const brg12 = bearing(latA, lonA, latB, lonB);
  const brg13 = bearing(latA, lonA, lat, lon);
  const d13 = haversineKm(latA, lonA, lat, lon) / R_EARTH;
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(brg13 - brg12))) * R_EARTH;
}
function distToPathKm(lat, lon, path) {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = crossTrackKm(lat, lon, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
    if (d < min) min = d;
  }
  path.forEach(p => { const d = haversineKm(lat, lon, p[0], p[1]); if (d < min) min = d; });
  return min;
}
function sunAltitude(lat, lon, date) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate();
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const jd = jdn + (date.getUTCHours() - 12) / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  const n = jd - 2451545, T = n / 36525;
  const L = (280.46646 + 36000.76983 * T) % 360;
  const g = toRad((357.52911 + 35999.05029 * T) % 360);
  const lam = toRad(L + 1.914602 * T * Math.sin(g) + 0.019993 * T * Math.sin(2 * g));
  const eps = toRad(23.439291 - 0.0130042 * T);
  const alpha = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const delta = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lst = toRad(ut * 15 + lon), H = lst - alpha, phi = toRad(lat);
  return Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H)) / DEG;
}
function calcLocal(e, lat, lon) {
  const crossKm = distToPathKm(lat, lon, e.path);
  const umbraHalf = e.pathWidthKm / 2;
  const sunAlt = sunAltitude(lat, lon, new Date(e.date));
  let maxObsc = 0, localType = 'none', visible = false;
  if (sunAlt > 0) {
    if (crossKm <= umbraHalf) {
      if (e.type === 'total') { maxObsc = 1; localType = 'total'; }
      else { maxObsc = e.magnitude; localType = 'annular'; }
      visible = true;
    } else if (crossKm <= umbraHalf + e.penUmbraKm) {
      const t = (crossKm - umbraHalf) / e.penUmbraKm;
      const centerObs = e.type === 'total' ? 1 : e.magnitude;
      maxObsc = centerObs * (1 - t * t) * 0.92;
      if (maxObsc > 0.02) { localType = 'partial'; visible = true; maxObsc = Math.min(0.95, maxObsc); }
    }
  }
  return { crossKm: Math.round(crossKm), sunAlt: Math.round(sunAlt * 10) / 10, maxObsc: Math.round(maxObsc * 1000) / 1000, localType, visible };
}
function phaseCurve(t, peak, type) {
  peak = peak != null ? peak : 1;
  let obsc, moonOff, phaseIdx;
  if (type === 'total') {
    if (t < 0.15) { obsc = t / 0.15 * 0.3 * peak; moonOff = 1 - t / 0.15 * 0.7; phaseIdx = 0; }
    else if (t < 0.35) { const p = (t - 0.15) / 0.2; obsc = (0.3 + p * 0.65) * peak; moonOff = 0.3 * (1 - p); phaseIdx = 1; }
    else if (t < 0.65) { obsc = (0.95 + (t - 0.35) / 0.3 * 0.05) * peak; moonOff = 0; phaseIdx = 2; }
    else if (t < 0.85) { const p = (t - 0.65) / 0.2; obsc = (1 - p * 0.65) * peak; moonOff = 0.3 * p; phaseIdx = 3; }
    else { obsc = (0.35 - (t - 0.85) / 0.15 * 0.35) * peak; moonOff = 0.3 + (t - 0.85) / 0.15 * 0.7; phaseIdx = 4; }
  } else if (type === 'annular') {
    if (t < 0.2) { obsc = t / 0.2 * 0.5 * peak; moonOff = 1 - t / 0.2 * 0.5; phaseIdx = 0; }
    else if (t < 0.4) { const p = (t - 0.2) / 0.2; obsc = (0.5 + p * 0.45) * peak; moonOff = 0.5 * (1 - p); phaseIdx = 1; }
    else if (t < 0.6) { obsc = (0.92 + (t - 0.4) / 0.2 * 0.04) * peak; moonOff = 0.05; phaseIdx = 2; }
    else if (t < 0.8) { const p = (t - 0.6) / 0.2; obsc = (0.96 - p * 0.46) * peak; moonOff = 0.05 + p * 0.45; phaseIdx = 3; }
    else { obsc = (0.5 - (t - 0.8) / 0.2 * 0.5) * peak; moonOff = 0.5 + (t - 0.8) / 0.2 * 0.5; phaseIdx = 4; }
  } else {
    obsc = Math.sin(t * Math.PI) * 0.85 * peak; moonOff = 1 - obsc; phaseIdx = t < 0.5 ? 0 : 4;
  }
  return { obsc: Math.max(0, Math.min(peak, obsc)), moonOff: Math.max(0, Math.min(1, moonOff)), phaseIdx };
}
function fmtCountdown(ms) {
  if (ms <= 0) return '已发生';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  if (d > 365) return Math.floor(d / 365) + '年后';
  if (d > 0) return d + '天' + h + '时';
  if (h > 0) return h + '时' + m + '分';
  return m + '分';
}

// ==================== 1. JS 语法 ====================
section('JS 语法');
try {
  const script = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(script);
  ok('index.html <script> 语法合法');
} catch (e) {
  fail('index.html <script> 语法', e.message);
}

// ==================== 2. 文件完整性 ====================
section('文件完整性');
const required = [
  'index.html', 'www/index.html', 'package.json', 'capacitor.config.json',
  'scripts/build-web.js', 'scripts/test-all.js', 'build.sh', 'serve.sh', 'AGENTS.md',
  'android/app/src/main/AndroidManifest.xml', 'ios/App/App/Info.plist',
];
for (const f of required) {
  fs.existsSync(path.join(ROOT, f)) ? ok(f) : fail(f, 'missing');
}
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const www = fs.readFileSync(path.join(ROOT, 'www/index.html'), 'utf8');
idx === www ? ok('index.html ↔ www 同步') : fail('index.html ↔ www 同步');

// ==================== 3. 权限 ====================
section('原生权限');
const manifest = fs.readFileSync(path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
manifest.includes('ACCESS_FINE_LOCATION') ? ok('Android FINE_LOCATION') : fail('Android FINE_LOCATION');
manifest.includes('ACCESS_COARSE_LOCATION') ? ok('Android COARSE_LOCATION') : fail('Android COARSE_LOCATION');
const plist = fs.readFileSync(path.join(ROOT, 'ios/App/App/Info.plist'), 'utf8');
plist.includes('NSLocationWhenInUseUsageDescription') ? ok('iOS location 描述') : fail('iOS location');

// ==================== 4. 日食数据 ====================
section('日食数据');
ECLIPSES.length === 8 ? ok('8 场日食') : fail('日食数量', ECLIPSES.length);
for (const e of ECLIPSES) {
  (!e.path || e.path.length < 2) ? fail(e.id, 'path') : ok(`${e.id} path ${e.path.length}点`);
}

// ==================== 5. 地理算法 ====================
section('地理算法');
const bjSh = haversineKm(39.9, 116.4, 31.2, 121.5);
Math.abs(bjSh - 1068) < 50 ? ok(`haversine 北京→上海 ${Math.round(bjSh)}km`) : fail('haversine', bjSh);
haversineKm(0, 0, 0, 0) < 0.01 ? ok('haversine 同点=0') : fail('haversine 同点');
// 雷克雅未克 2026-08-12 食甚时刻太阳应在地平线以上 (~8°)
const iceAlt = sunAltitude(64.1, -21.9, new Date('2026-08-12T17:47:00Z'));
iceAlt > 5 && iceAlt < 15 ? ok(`太阳高度 雷克雅未克食甚 ${iceAlt.toFixed(1)}°`) : fail('太阳高度 雷克雅未克', iceAlt);

// ==================== 6. 关键城市断言 ====================
section('本地食分 · 关键断言');
const ice2026 = calcLocal(ECLIPSES.find(e => e.id === '2026-08-12'), 64.1, -21.9);
(ice2026.localType === 'total' && ice2026.crossKm < 50)
  ? ok(`2026全食 雷克雅未克 → 全食 ${Math.round(ice2026.maxObsc * 100)}% (${ice2026.crossKm}km)`)
  : fail('2026全食 雷克雅未克', JSON.stringify(ice2026));

!calcLocal(ECLIPSES.find(e => e.id === '2026-08-12'), 39.9, 116.4).visible
  ? ok('2026全食 北京 → 不可见') : fail('2026全食 北京');

const cairo2027 = calcLocal(ECLIPSES.find(e => e.id === '2027-08-02'), 30.0, 31.2);
cairo2027.visible ? ok(`2027全食 开罗 → ${TYPE_CN[cairo2027.localType]} ${Math.round(cairo2027.maxObsc * 100)}%`) : fail('2027全食 开罗', JSON.stringify(cairo2027));

const pan2031 = calcLocal(ECLIPSES.find(e => e.id === '2031-11-14'), 8.98, -79.52);
(pan2031.localType === 'total' || pan2031.maxObsc > 0.5)
  ? ok(`2031全食 巴拿马 → ${TYPE_CN[pan2031.localType]} ${Math.round(pan2031.maxObsc * 100)}%`)
  : fail('2031全食 巴拿马', JSON.stringify(pan2031));

section('本地食分 · 城市矩阵');
const CITIES = [['雷克雅未克', 64.1, -21.9], ['马德里', 40.4, -3.7], ['北京', 39.9, 116.4], ['上海', 31.2, 121.5], ['悉尼', -33.9, 151.2], ['圣地亚哥', -33.4, -70.6], ['开罗', 30.0, 31.2], ['巴拿马城', 8.98, -79.52]];
for (const [name, lat, lon] of CITIES) {
  const vis = ECLIPSES.filter(e => calcLocal(e, lat, lon).visible);
  console.log(`     ${name.padEnd(8)} 可见 ${vis.length}/8 场`);
}
ok('城市矩阵完成');

// ==================== 7. phaseCurve ====================
section('食相曲线');
const totalPh = phaseCurve(0.5, 1, 'total');
totalPh.atMax ?? totalPh;
phaseCurve(0, 1, 'total').obsc < 0.05 ? ok('全食 t=0 ≈0%') : fail('全食 t=0');
phaseCurve(0.5, 1, 'total').obsc >= 0.95 ? ok(`全食 t=0.5 ${(phaseCurve(0.5, 1, 'total').obsc * 100).toFixed(0)}%`) : fail('全食 t=0.5');
phaseCurve(1, 1, 'total').obsc < 0.05 ? ok('全食 t=1 ≈0%') : fail('全食 t=1');
const annMax = phaseCurve(0.5, 0.92, 'annular').obsc;
annMax >= 0.85 && annMax <= 0.95 ? ok(`环食 t=0.5 ${(annMax * 100).toFixed(0)}%`) : fail('环食 t=0.5', annMax);
const pMax = phaseCurve(0.5, 0.42, 'total').obsc;
Math.abs(pMax - 0.42 * 0.97) < 0.05 ? ok(`偏食 peak=42% → ${(pMax * 100).toFixed(0)}%`) : fail('偏食缩放', pMax);
let phaseOk = true;
for (let t = 0; t <= 1; t += 0.05) {
  const p = phaseCurve(t, 0.6, 'total');
  if (p.obsc > 0.601 || p.obsc < 0 || p.phaseIdx < 0 || p.phaseIdx > 4) phaseOk = false;
}
phaseOk ? ok('phaseIdx/obsc 边界') : fail('phaseIdx/obsc 边界');

// ==================== 8. fmtCountdown ====================
section('倒计时');
fmtCountdown(-1000) === '已发生' ? ok('已发生') : fail('已发生');
fmtCountdown(86400000 * 400) === '1年后' ? ok('1年后') : fail('1年后', fmtCountdown(86400000 * 400));
fmtCountdown(86400000 * 5 + 3600000 * 3) === '5天3时' ? ok('5天3时') : fail('5天3时');
fmtCountdown(3600000 * 2 + 60000 * 30) === '2时30分' ? ok('2时30分') : fail('2时30分');
fmtCountdown(60000 * 45) === '45分' ? ok('45分') : fail('45分');

// ==================== 9. 构建 & HTML ====================
section('构建脚本');
try { execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'pipe' }); ok('build-web.js'); } catch (e) { fail('build-web.js', e.message); }

section('HTML 结构');
for (const [needle, label] of [['#loc-bar', 'loc-bar'], ['#local-info', 'local-info'], ['calcLocal', 'calcLocal'], ['localPeakObsc', 'localPeakObsc'], ['reqGPS', 'reqGPS']]) {
  idx.includes(needle) ? ok(label) : fail(label);
}

section('Capacitor');
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
cap.appId === 'com.rishi.guan' ? ok('appId') : fail('appId');
cap.webDir === 'www' ? ok('webDir') : fail('webDir');

console.log('\n════════════════════════════════');
console.log(`  单元测试: ${passed} 通过, ${failed} 失败`);
console.log('════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
