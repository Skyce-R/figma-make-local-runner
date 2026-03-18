import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"
import tailwindcss from '@tailwindcss/vite'


/**
 * A custom Vite plugin to automatically remove version specifiers from import statements.
 * For example:
 *   import { Slot } from "@radix-ui/react-slot@1.1.2";
 * becomes:
 *   import { Slot } from "@radix-ui/react-slot";
 */

function removeVersionSpecifiers(): Plugin {
  const VERSION_PATTERN = /@\d+\.\d+\.\d+/;

  return {
    name: 'remove-version-specifiers',

    resolveId(id: string, importer) {
      if (VERSION_PATTERN.test(id)) {
        const cleanId= id.replace(VERSION_PATTERN, '');
        return this.resolve(cleanId, importer, { skipSelf: true });
      }
      return null;
    },
  }
}


/**
 * A custom Vite plugin to resolve imports with the "figma:assets/" prefix.
 */
function figmaAssetsResolver(): Plugin {
  const FIGMA_ASSETS_PREFIX = 'figma:asset/';

  return {
    name: 'figma-assets-resolver',

    resolveId(id: string) {
      if (id.startsWith(FIGMA_ASSETS_PREFIX)) {
        const assetPath = id.substring(FIGMA_ASSETS_PREFIX.length);
        return path.resolve(__dirname, './src/assets', assetPath);
      }
      return null;
    },
  };
}


const produceSingleFile = process.env.SINGLE_FILE === 'true'

/**
 * A custom Vite plugin to automatically convert BrowserRouter to HashRouter
 * when building single file. This is necessary because single-file HTML cannot
 * use BrowserRouter (it requires server-side routing configuration).
 *
 * This plugin modifies src/app/routes.ts in-memory before building,
 * so the source files remain unchanged.
 */
function autoHashRouter(): Plugin {
  let routesContent: string | null = null;

  return {
    name: 'auto-hash-router',

    async buildStart() {
      if (!produceSingleFile) return;

      const routesPath = path.resolve(__dirname, './src/app/routes.ts');
      const fs = await import('fs');

      if (fs.existsSync(routesPath)) {
        routesContent = fs.readFileSync(routesPath, 'utf-8');

        // Replace BrowserRouter with HashRouter
        const modified = routesContent
          .replace(/createBrowserRouter/g, 'createHashRouter')
          .replace(/from\s+"react-router";?/g, 'from "react-router";');

        fs.writeFileSync(routesPath, modified, 'utf-8');
        console.log('[auto-hash-router] Converted BrowserRouter to HashRouter for single-file build');
      }
    },

    async buildEnd() {
      if (!produceSingleFile || !routesContent) return;

      // Restore original content after build
      const routesPath = path.resolve(__dirname, './src/app/routes.ts');
      const fs = await import('fs');
      fs.writeFileSync(routesPath, routesContent, 'utf-8');
      console.log('[auto-hash-router] Restored original routes.ts');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    figmaAssetsResolver(),
    removeVersionSpecifiers(),
    autoHashRouter(),
    ...(produceSingleFile ? [viteSingleFile()] : [])
  ],
})

