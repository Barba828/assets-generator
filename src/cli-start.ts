import cac from 'cac'
import { consola } from 'consola'
import { green } from 'colorette'
import { version } from '../package.json'
import { loadConfig } from './config.ts'
import type { BuiltInPreset, Preset, ResolvedAssets, UserConfig } from './config.ts'
import { defaultAssetName, defaultPngCompressionOptions, toResolvedAsset } from './utils.ts'
import { generatePWAAssets } from './build.ts'

interface CliOptions extends Omit<UserConfig, 'preset' | 'images'> {
  preset?: BuiltInPreset
}

export async function startCli(args: string[] = process.argv) {
  const cli = cac('pwa-assets-generator')

  cli
    .version(version)
    .option('-r, --root <path>', 'Root path')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --preset <preset-name>', 'Built-in preset name: minimal, android, windows, ios or all')
    .option('-o, --override', 'Override assets? Defaults to true')
    .help()
    .command(
      '[...images]',
      'Generate PWA assets from images files',
    ).action((images, options) => run(images, options))

  cli.parse(args)
}

async function run(images: string[] = [], cliOptions: CliOptions = {}) {
  consola.log(green(`Zero Config PWA Assets Generator v${version}`))
  consola.start('Preparing to generate PWA assets...')

  const root = cliOptions?.root ?? process.cwd()

  const { config } = await loadConfig<UserConfig>(root, cliOptions)

  if (!config.preset)
    throw new Error('No preset found')

  if (images?.length)
    config.images = images

  if (!config.images?.length)
    throw new Error('No images provided')

  const {
    logLevel = 'info',
    overrideAssets = true,
    preset = 'minimal',
    images: configImages,
  } = config

  const useImages = Array.isArray(configImages) ? configImages : [configImages]

  let usePreset: Preset
  if (typeof preset === 'object') {
    usePreset = preset
  }
  else {
    switch (preset) {
      case 'minimal':
        usePreset = await import('./presets/minimal.ts').then(m => m.minimalPreset)
        break
      default:
        throw new Error(`Preset ${preset} not yet implemented`)
    }
  }

  const {
    assetName = defaultAssetName,
    png = defaultPngCompressionOptions,
  } = usePreset

  const assets: ResolvedAssets = {
    assets: {
      transparent: toResolvedAsset('transparent', usePreset.transparent),
      maskable: toResolvedAsset('maskable', usePreset.maskable),
      apple: toResolvedAsset('apple', usePreset.apple),
    },
    png,
    assetName,
  }

  consola.ready('PWA assets ready to be generated')
  consola.start(`Generating PWA assets from ${useImages.join(', ')} image${useImages.length > 1 ? 's' : ''}`)

  await generatePWAAssets(
    useImages,
    assets,
    { root, logLevel, overrideAssets },
  )
  consola.ready('PWA assets generated')
}
