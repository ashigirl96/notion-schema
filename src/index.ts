import { loadConfig } from '@/config'

console.log('Hello via Bun!')
console.log(await loadConfig())
