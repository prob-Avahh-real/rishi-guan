const fs = require('fs');
const path = require('path');
const www = path.join(__dirname, '..', 'www');
if (!fs.existsSync(path.join(www, 'index.html'))) {
  console.error('❌ www/index.html not found — run build.sh first');
  process.exit(1);
}
console.log('✅ 日食观 web build ok');
