import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directory = mkdtempSync(join(tmpdir(), 'fullstack-copier-'))
const source = join(directory, 'template')
const product = join(directory, 'product')
function run(command, args, cwd = source, allowFailure = false) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        env: {
            ...process.env,
            CI: 'true',
            GIT_AUTHOR_NAME: 'Template Test',
            GIT_AUTHOR_EMAIL: 'template@example.test',
            GIT_COMMITTER_NAME: 'Template Test',
            GIT_COMMITTER_EMAIL: 'template@example.test',
        },
    })
    if (!allowFailure && (result.error || result.status !== 0))
        throw new Error(
            `${command} ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.stdout}`,
        )
    return result
}
function commit(cwd, message) {
    run('git', ['add', '--all'], cwd)
    run('git', ['-c', 'commit.gpgsign=false', 'commit', '-qm', message], cwd)
}
try {
    mkdirSync(source)
    run('copier', ['--version'])
    // Snapshot source without changing the real repository's index or commits.
    const paths = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], root)
        .stdout.split('\0')
        .filter(Boolean)
    for (const path of new Set(paths)) {
        if (!existsSync(join(root, path))) continue
        mkdirSync(dirname(join(source, path)), { recursive: true })
        cpSync(join(root, path), join(source, path))
    }
    writeFileSync(join(source, 'template-upgrade-fixture.txt'), 'base\n')
    for (const path of [
        '.env',
        '.env.production',
        'backups/private.dump',
        'statsd/private-token',
        'node_modules/private.txt',
        'frontend/.next/private.txt',
        'frontend/universal/.generated/public-env.json',
    ]) {
        mkdirSync(dirname(join(source, path)), { recursive: true })
        writeFileSync(join(source, path), 'DO_NOT_COPY_PRIVATE_FIXTURE')
    }
    run('git', ['init', '-q'])
    commit(source, 'Template v1')
    // Even accidentally tracked secrets/build outputs must not be rendered.
    run('git', [
        'add',
        '-f',
        '.env',
        '.env.production',
        'backups/private.dump',
        'statsd/private-token',
        'node_modules/private.txt',
        'frontend/.next/private.txt',
        'frontend/universal/.generated/public-env.json',
    ])
    run('git', ['-c', 'commit.gpgsign=false', 'commit', '-qm', 'Private exclusion fixtures'])
    run('git', ['tag', 'v1.0.0'])
    console.log('Copier: rendering full source snapshot...')
    const appName = 'Student $& App'
    run('copier', [
        'copy',
        '--defaults',
        '--vcs-ref',
        'v1.0.0',
        '-d',
        'project_slug=student-app',
        '-d',
        `project_name=${appName}`,
        source,
        product,
    ])
    const identity = JSON.parse(readFileSync(join(product, 'project.json'), 'utf8'))
    assert.deepEqual(identity, { slug: 'student-app', name: appName })
    for (const path of [
        '.env',
        '.env.production',
        'backups',
        'statsd',
        'node_modules',
        'frontend/.next',
        'frontend/universal/.generated',
        'backend/drizzle 2',
    ])
        assert.equal(existsSync(join(product, path)), false, path)
    assert.ok(existsSync(join(product, '.env.example')))
    for (const path of [
        'package.json',
        'pnpm-lock.yaml',
        'frontend/app/page.tsx',
        'infrastructure/tmux.mjs',
        'statsd.sh',
    ]) {
        if (existsSync(join(source, path)))
            assert.equal(readFileSync(join(product, path), 'utf8'), readFileSync(join(source, path), 'utf8'))
    }
    const answers = readFileSync(join(product, '.copier-answers.yml'), 'utf8')
    assert.match(answers, /v1\.0\.0/)
    assert.doesNotMatch(answers, /DO_NOT_COPY|PASSWORD|SECRET/)
    run(process.execPath, ['infrastructure/setup.mjs', 'init'], product)
    const privateEnv = readFileSync(join(product, '.env'), 'utf8')
    assert.match(privateEnv, /^APP_ID=student-app-[a-f0-9]{6}$/m)
    assert.ok(privateEnv.includes(`APP_NAME=${JSON.stringify(appName)}`))
    assert.doesNotMatch(privateEnv, /^NEXT_PUBLIC_APP_NAME=|^NEXT_PUBLIC_APP_URL=|^BETTER_AUTH_URL=/m)
    const configured = new URL(privateEnv.match(/^DATABASE_URL=(.*)$/m)[1])
    assert.equal(configured.username, 'starter')
    assert.equal(configured.pathname, '/starter')
    const loadedName = run(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `import { parseEnv } from 'node:util'; import { readFileSync } from 'node:fs'; console.log(JSON.stringify(parseEnv(readFileSync('.env', 'utf8')).APP_NAME));`,
        ],
        product,
    ).stdout.trim()
    assert.equal(JSON.parse(loadedName), appName)
    run(process.execPath, ['infrastructure/setup.mjs', 'init'], product)
    assert.equal(readFileSync(join(product, '.env'), 'utf8'), privateEnv)
    run('git', ['init', '-q'], product)
    writeFileSync(join(product, 'product-feature.txt'), 'custom product code\n')
    writeFileSync(join(product, 'template-upgrade-fixture.txt'), 'product customization\n')
    commit(product, 'Customized product')
    console.log('Copier: rehearsing clean and conflicting upgrades...')
    writeFileSync(join(source, 'upstream-improvement.txt'), 'foundation upgrade\n')
    commit(source, 'Nonconflicting upgrade')
    run('git', ['tag', 'v1.1.0'])
    run('copier', ['update', '--defaults', '--vcs-ref', 'v1.1.0'], product)
    assert.equal(readFileSync(join(product, 'upstream-improvement.txt'), 'utf8'), 'foundation upgrade\n')
    assert.equal(readFileSync(join(product, 'template-upgrade-fixture.txt'), 'utf8'), 'product customization\n')
    assert.equal(readFileSync(join(product, 'product-feature.txt'), 'utf8'), 'custom product code\n')
    assert.equal(readFileSync(join(product, '.env'), 'utf8'), privateEnv)
    commit(product, 'Apply nonconflicting update')
    writeFileSync(join(source, 'template-upgrade-fixture.txt'), 'upstream customization\n')
    commit(source, 'Conflicting upgrade')
    run('git', ['tag', 'v1.2.0'])
    run('copier', ['update', '--defaults', '--conflict', 'inline', '--vcs-ref', 'v1.2.0'], product, true)
    const conflict = readFileSync(join(product, 'template-upgrade-fixture.txt'), 'utf8')
    assert.match(conflict, /<<<<<<<[\s\S]*=======/)
    assert.match(conflict, /product customization/)
    assert.match(conflict, /upstream customization/)
    writeFileSync(join(product, 'template-upgrade-fixture.txt'), 'product customization\nupstream customization\n')
    commit(product, 'Resolve rehearsed conflict')
    assert.equal(readFileSync(join(product, '.env'), 'utf8'), privateEnv)
    if (process.argv.includes('--verify')) {
        console.log('Copier: installing and verifying the generated product...')
        run('pnpm', ['install', '--frozen-lockfile'], product)
        run('pnpm', ['verify'], product)
    }
    console.log(
        'Copier passed: full source copy, identity/setup, secret exclusions, customized upgrade, conflict resolution, and private environment preservation.',
    )
} finally {
    rmSync(directory, { recursive: true, force: true })
}
