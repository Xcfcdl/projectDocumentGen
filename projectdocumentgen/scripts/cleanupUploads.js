const fs = require('fs-extra');
const path = require('path');

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
const now = Date.now();
const expire = 5 * 60 * 1000; // 5分钟

if (!fs.existsSync(uploadsRoot)) process.exit(0);

fs.readdirSync(uploadsRoot).forEach(dir => {
  const taskDir = path.join(uploadsRoot, dir);
  const activeFile = path.join(taskDir, '.active');
  if (fs.existsSync(activeFile)) {
    const lastActive = parseInt(fs.readFileSync(activeFile, 'utf-8'));
    if (now - lastActive > expire) {
      fs.removeSync(taskDir);
      console.log(`已清理过期任务: ${dir}`);
    }
  }
}); 