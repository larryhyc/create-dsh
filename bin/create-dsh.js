#!/usr/bin/env node
import { run } from '../src/index.js'

run().catch((error) => {
  const message = error && error.message ? error.message : String(error)
  process.stderr.write(`\n  create-dsh: ${message}\n\n`)
  process.exit(1)
})
