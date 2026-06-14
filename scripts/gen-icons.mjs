import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url))
const out = (size, name) =>
  sharp(svg).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)))

await Promise.all([
  out(192, 'icon-192.png'),
  out(512, 'icon-512.png'),
  out(180, 'apple-touch-icon-180.png'),
])
console.log('icons generated')
