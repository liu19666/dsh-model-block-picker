#!/usr/bin/env node
/**
 * Print the CHANGELOG section for the version in package.json, for use as the
 * body of the GitHub Release the publish workflow creates.
 *
 * Why a script rather than a `sed` range in the workflow: the heading format
 * carries an optional date, entries are separated by blank lines, and the
 * section that must NEVER be picked is `[Unreleased]` — a bracket that a
 * naive `## \[1.1.0\]` glob would also match if the version were ever spelled
 * that way. One tiny module keeps that logic reviewable and testable.
 *
 * Usage: node scripts/release-notes.mjs [repo-root]
 *   stdout: the section body (heading stripped — the Release title carries
 *           the version), or nothing when the version has no section yet.
 *   exit:   0 on success, 1 on a read/parse error.
 *
 * Deliberately dependency-free and side-effect-free apart from stdout so it
 * runs identically on a dev box and in CI.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? process.cwd()

function readText(at) {
  // Normalise CRLF: a checkout on Windows leaves them, and a regex written
  // against `\n` would then miss every heading on the maintainer's machine
  // while passing in CI — the worst possible split.
  return readFileSync(at, 'utf8').replace(/\r\n/gu, '\n')
}

let version
try {
  version = JSON.parse(readText(join(root, 'package.json'))).version
} catch (error) {
  process.stderr.write(`release-notes: cannot read package.json: ${error.message}\n`)
  process.exit(1)
}

let changelog
try {
  changelog = readText(join(root, 'CHANGELOG.md'))
} catch (error) {
  // A repository with no CHANGELOG is not an error worth failing a release
  // over: the workflow falls back to GitHub's generated notes.
  process.stderr.write(`release-notes: no CHANGELOG.md (${error.message}); releasing without curated notes\n`)
  process.exit(0)
}

const heading = /^##[ \t]+\[([^\]]+)\][^\n]*$/u
const lines = changelog.split('\n')

let start = -1
let end = lines.length
for (let i = 0; i < lines.length; i++) {
  const match = heading.exec(lines[i])
  if (match === null) continue
  // First heading wins: a repeated version means the file is malformed, and
  // the earliest section is the one a maintainer would have written first.
  if (start !== -1) {
    end = i
    break
  }
  if (match[1].trim() === version) start = i
}

if (start === -1) {
  process.stderr.write(`release-notes: CHANGELOG has no [${version}] section; releasing without curated notes\n`)
  process.exit(0)
}

// Drop the heading itself and any leading blank lines; keep everything up to
// the next version's heading.
const body = lines
  .slice(start + 1, end)
  .join('\n')
  .replace(/^\n+/u, '')
  .replace(/\n+$/u, '')

if (body === '') {
  process.stderr.write(`release-notes: [${version}] section is empty; releasing without curated notes\n`)
  process.exit(0)
}

process.stdout.write(`${body}\n`)
