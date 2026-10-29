import { execSync } from 'child_process';

const git = 'C:\\Users\\wille\\AppData\\Local\\Programs\\Git\\cmd\\git.exe';

function run(cmd) {
  console.log(`> ${cmd}`);
  const out = execSync(`"${git}" ${cmd}`, { encoding: 'utf-8' });
  if (out.trim()) console.log(out.trim());
}

try {
  run('init');
  run('config user.name "wilveg0225-wq"');
  run('config user.email "wilveg0225@users.noreply.github.com"');
  run('branch -M main');
  run('add .');
  run('commit -m "Fixa CineMinde: iOS Safe Area, multi-kategorier & rätt index.html"');
  run('status');
} catch (err) {
  console.error('Git error:', err.message);
  if (err.stdout) console.log('stdout:', err.stdout.toString());
  if (err.stderr) console.log('stderr:', err.stderr.toString());
}
