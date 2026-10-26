import { stdin, stdout } from 'node:process'
import readline from 'node:readline'

// 只有真正的交互式终端才启用原始按键模式；管道/重定向时回退默认值
const interactive = Boolean(stdin.isTTY && stdout.isTTY)
let keypressReady = false

function ensureKeypress() {
  if (keypressReady) return
  readline.emitKeypressEvents(stdin)
  keypressReady = true
}

const cyan = (text) => `\x1b[36m${text}\x1b[0m`
const dim = (text) => `\x1b[2m${text}\x1b[0m`
const bold = (text) => `\x1b[1m${text}\x1b[0m`
const showCursor = () => stdout.write('\x1b[?25h')
const hideCursor = () => stdout.write('\x1b[?25l')

/**
 * 上下键选择 + 回车确认（类似 Vite 的交互）。
 * @param {{ message: string, options: { label: string, value: any, hint?: string }[], defaultIndex?: number }} params
 * @returns {Promise<any>} 选中项的 value
 */
export function select({ message, options, defaultIndex = 0 }) {
  if (!interactive) return Promise.resolve(options[defaultIndex].value)
  ensureKeypress()

  return new Promise((resolve) => {
    let index = defaultIndex
    const count = options.length

    const renderOptions = (first) => {
      // 非首次渲染时，把光标移回选项区顶部再重画
      if (!first) stdout.write(`\x1b[${count}A`)
      for (let i = 0; i < count; i++) {
        const opt = options[i]
        const active = i === index
        const marker = active ? cyan('❯') : ' '
        const label = active ? bold(cyan(opt.label)) : opt.label
        const hint = opt.hint ? `  ${dim(opt.hint)}` : ''
        stdout.write(`\x1b[2K${marker} ${label}${hint}\n`)
      }
    }

    stdout.write(`${cyan('?')} ${message}\n`)
    renderOptions(true)
    hideCursor()

    stdin.setRawMode(true)
    stdin.resume()

    const cleanup = () => {
      stdin.removeListener('keypress', onKey)
      stdin.setRawMode(false)
      stdin.pause()
      showCursor()
    }

    const onKey = (str, key) => {
      if (!key) return
      if (key.ctrl && key.name === 'c') {
        cleanup()
        stdout.write('\n')
        process.exit(130)
      }
      if (key.name === 'up') {
        index = (index - 1 + count) % count
        renderOptions(false)
      } else if (key.name === 'down') {
        index = (index + 1) % count
        renderOptions(false)
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        resolve(options[index].value)
      }
    }

    stdin.on('keypress', onKey)
  })
}

/**
 * 单行文本输入，回车确认。
 * @param {{ message: string, defaultValue?: string }} params
 * @returns {Promise<string>}
 */
export function promptText({ message, defaultValue = '' }) {
  if (!interactive) return Promise.resolve(defaultValue)
  ensureKeypress()

  return new Promise((resolve) => {
    let value = ''
    const hint = defaultValue ? ` ${dim(`(${defaultValue})`)}` : ''
    stdout.write(`${cyan('?')} ${message}${hint} `)

    stdin.setRawMode(true)
    stdin.resume()

    const cleanup = () => {
      stdin.removeListener('keypress', onKey)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
    }

    const onKey = (str, key) => {
      if (!key) return
      if (key.ctrl && key.name === 'c') {
        cleanup()
        process.exit(130)
      }
      if (key.name === 'return' || key.name === 'enter') {
        const result = value.trim() || defaultValue
        cleanup()
        resolve(result)
        return
      }
      if (key.name === 'backspace') {
        if (value.length > 0) {
          value = value.slice(0, -1)
          stdout.write('\b \b')
        }
        return
      }
      if (str && !key.ctrl && !key.meta) {
        value += str
        stdout.write(str)
      }
    }

    stdin.on('keypress', onKey)
  })
}
