const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(rootDir, 'package.json'));
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const version = String(packageJson.version || '0.0.1');
const parts = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
const computedVersionCode = (parts[0] * 10000) + (parts[1] * 100) + parts[2];
const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE || '', 10) || Math.max(1, computedVersionCode);

let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');
console.log(`Android version synced: versionName=${version}, versionCode=${versionCode}`);
