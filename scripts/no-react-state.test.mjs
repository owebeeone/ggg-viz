// Gate: no react state hooks anywhere in src/ — state is modeled with grips/taps.
// (Single-app variant of the gryth-ui scanner.)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BANNED = ['useState', 'useEffect', 'useRef', 'useReducer', 'useMemo', 'useCallback', 'useLayoutEffect']
const ROOT = new URL('../src', import.meta.url).pathname

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
  }
}

// Strip comments and string/template literals so mentions in prose don't trip the gate.
function stripInert(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

const offenders = []
for (const file of walk(ROOT)) {
  const code = stripInert(readFileSync(file, 'utf8'))
  for (const hook of BANNED) {
    if (new RegExp(`\\b${hook}\\b`).test(code)) offenders.push(`${file}: ${hook}`)
  }
}

if (offenders.length) {
  console.error('BANNED react state hooks found (model state with grips/taps):')
  for (const o of offenders) console.error('  ' + o)
  process.exit(1)
}
console.log('no-react-state: clean')
