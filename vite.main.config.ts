import path from 'node:path';
import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

const external = [
  'electron',
  'electron-updater',
  'mammoth',
  'pdf-parse',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`)
];

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        main: path.resolve(__dirname, 'src/main/main.ts'),
        preload: path.resolve(__dirname, 'src/main/preload.ts'),
        'capture-preload': path.resolve(__dirname, 'src/main/capture-preload.ts')
      },
      formats: ['cjs']
    },
    rollupOptions: {
      external,
      output: {
        entryFileNames: '[name].cjs',
        chunkFileNames: 'chunks/[name].cjs'
      }
    }
  }
});
