const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', '.next');
const targetDir = path.join(__dirname, '..', 'functions', '.next');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy standalone folder
const standaloneSource = path.join(sourceDir, 'standalone');
const standaloneTarget = path.join(targetDir, 'standalone');

if (fs.existsSync(standaloneSource)) {
  copyRecursiveSync(standaloneSource, standaloneTarget);
  // Copied standalone folder
} else {
  // Failed to copy standalone folder
  process.exit(1);
}

// Ensure .next folder exists in standalone
const nextInStandalone = path.join(standaloneTarget, '.next');
if (!fs.existsSync(nextInStandalone)) {
  fs.mkdirSync(nextInStandalone, { recursive: true });
}

// Copy static folder to standalone/.next/static
const staticSource = path.join(sourceDir, 'static');
const staticTargetInStandalone = path.join(nextInStandalone, 'static');

if (fs.existsSync(staticSource)) {
  copyRecursiveSync(staticSource, staticTargetInStandalone);
  // Copied static folder
}

// Copy server folder to standalone/.next/server (needed for Next.js)
const serverSource = path.join(sourceDir, 'server');
const serverTargetInStandalone = path.join(nextInStandalone, 'server');

if (fs.existsSync(serverSource)) {
  copyRecursiveSync(serverSource, serverTargetInStandalone);
  // Copied server folder
}

// Copy public folder to standalone/public (if not already there)
const publicSource = path.join(__dirname, '..', 'public');
const publicTarget = path.join(standaloneTarget, 'public');

if (fs.existsSync(publicSource) && !fs.existsSync(publicTarget)) {
  copyRecursiveSync(publicSource, publicTarget);
  // Copied public folder
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Build copy completed successfully

