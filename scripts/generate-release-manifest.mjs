// Helper script to construct latest.json update manifest for GitHub Releases
import fs from 'node:fs';
import path from 'node:path';

const tauriConfigPath = path.resolve('src-tauri/tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

const version = tauriConfig.version || '1.0.0';
const notes = 'تحديث نظام إدارة المحل - تحسينات الأداء، دعم التحديث التلقائي الموقع، وتأمين البيانات المحلية';
const pubDate = new Date().toISOString();

const manifest = {
  version,
  notes,
  pub_date: pubDate,
  platforms: {
    'windows-x86_64': {
      signature: '',
      url: `https://github.com/shop-system/shop-management/releases/download/v${version}/Shop-Management-System_${version}_x64-setup.nsis.zip`,
    },
  },
};

const outputDir = path.resolve('dist-release');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outputDir, 'latest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

console.log('✅ Generated sample update manifest at dist-release/latest.json for v' + version);
