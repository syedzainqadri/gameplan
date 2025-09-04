import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(async ({ mode }) => {
  const isDev = mode === 'development'
  const frappeui = await importFrappeUIPlugin(isDev)

  const config = {
    define: {
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
    plugins: [
      frappeui({
        frappeProxy: true,
        lucideIcons: true,
        jinjaBootData: true,
        frappeTypes: {
          input: {
            gameplan: [
              'gp_project',
              'gp_member',
              'gp_team',
              'gp_comment',
              'gp_discussion',
              'gp_page',
              'gp_task',
              'gp_poll',
              'gp_guest_access',
              'gp_invitation',
              'gp_user_profile',
              'gp_notification',
              'gp_activity',
              'gp_search_feedback',
              'gp_draft',
              'gp_tag',
            ],
          },
        },
        buildConfig: {
          indexHtmlPath: '../gameplan/www/g.html',
        },
      }),
      vue(),
      vueJsx(),
      visualizer({ emitFile: true }),
    ],
    server: {
      allowedHosts: true,
      fs: {
        allow: [
          // Allow serving files from project root, node_modules, and frappe-ui. To fix the error:
          // The request url "~/frappe-bench/apps/gameplan/frappe-ui/src/fonts/Inter/Inter-Medium.woff2" is outside of Vite serving allow list.
          '..',
          'node_modules',
          '../frappe-ui',
        ],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'tailwind.config.js': path.resolve(__dirname, 'tailwind.config.js'),
      },
    },
    optimizeDeps: {
      include: ['feather-icons', 'showdown', 'tailwind.config.js'],
    },
  }

  // Add local frappe-ui alias only in development if the local frappe-ui exists
  if (isDev) {
    try {
      // Check if the local frappe-ui directory exists
      const fs = await import('node:fs')
      const localFrappeUIPath = path.resolve(__dirname, '../frappe-ui')
      if (fs.existsSync(localFrappeUIPath)) {
        config.resolve.alias['frappe-ui'] = localFrappeUIPath

        // Dynamically resolve TipTap packages to avoid error: Adding different instances of a keyed plugin
        const gameplanNodeModules = path.resolve(__dirname, 'node_modules/@tiptap')
        const frappeUINodeModules = path.resolve(localFrappeUIPath, 'node_modules/@tiptap')

        const gameplanTiptapPackages = fs.readdirSync(gameplanNodeModules)
        const frappeUITiptapPackages = fs.readdirSync(frappeUINodeModules)

        // Find packages that exist in both locations
        const commonTiptapPackages = gameplanTiptapPackages.filter((pkg) =>
          frappeUITiptapPackages.includes(pkg),
        )

        // Alias common packages to gameplan's node_modules to ensure single instance
        commonTiptapPackages.forEach((pkg) => {
          const packageName = `@tiptap/${pkg}`
          config.resolve.alias[packageName] = path.resolve(__dirname, 'node_modules', packageName)
        })
      } else {
        console.warn('Local frappe-ui directory not found, using npm package')
      }
    } catch (error) {
      console.warn('Error checking for local frappe-ui, using npm package:', error.message)
    }
  }

  return config
})

async function importFrappeUIPlugin(isDev) {
  if (isDev) {
    try {
      const module = await import('../frappe-ui/vite')
      return module.default
    } catch (error) {
      console.warn('Local frappe-ui not found, falling back to npm package:', error.message)
    }
  }
  // Fall back to npm package if local import fails
  const module = await import('frappe-ui/vite')
  return module.default
}
