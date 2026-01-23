import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function build() {
  try {
    console.log('Starting Vite build...');
    const { stdout, stderr } = await execAsync('node ./node_modules/vite/bin/vite.js build');
    console.log(stdout);
    if (stderr) console.error(stderr);
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();