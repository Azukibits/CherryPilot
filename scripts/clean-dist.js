const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

function remove(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`Refusing to remove outside project: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function removeIfExists(name) {
  const targetPath = path.join(distDir, name);
  if (fs.existsSync(targetPath)) {
    remove(targetPath);
  }
}

if (process.argv.includes('--before')) {
  remove(distDir);
  process.exit(0);
}

if (process.argv.includes('--after')) {
  removeIfExists('win-unpacked');
  removeIfExists('builder-debug.yml');
  removeIfExists('dist-build.err.log');
  removeIfExists('dist-build.out.log');
  process.exit(0);
}

console.log('Usage: node scripts/clean-dist.js --before|--after');
