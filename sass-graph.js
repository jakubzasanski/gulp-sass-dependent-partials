'use strict'

// #####################################################################################################################

/**
 * @author Jakub Zasański <jakub.zasanski.dev@gmail.com>
 * @version 1.0.0
 */

// #####################################################################################################################

import fs from 'node:fs'
import path from 'node:path'
import glob from 'glob'
import tokenizer from 'scss-tokenizer'
import process from 'node:process'

// #####################################################################################################################

export default class Graph {
    constructor(dir, options) {
        this.options = this.processOptions(options)
        this.index = {}

        if (this.options.exclude !== null && !(this.options.exclude instanceof RegExp)) {
            throw new Error('Options exclude in not a instance of RegExp.')
        }

        this.loadPaths = this.options.loadPaths.map((p) => path.resolve(p))

        if (!dir) {
            throw new Error('Base dir is required.')
        }

        this.dir = path.resolve(dir)
    }

    /**
     *
     * Set class options
     *
     * @param {Object} options
     * @return {Object}
     *
     */
    processOptions(options) {
        const defaults = {
            loadPaths: [process.cwd()],
            extensions: ['scss', 'sass'],
            follow: false,
            exclude: null,
        }

        return Object.assign(defaults, options)
    }

    /**
     *
     * Create graph from base dir
     *
     * @return {Object}
     *
     */
    createGraph() {
        glob.sync(`${this.dir}/**/*.@(${this.options.extensions.join('|')})`, {
            dot: true,
            nodir: true,
            follow: this.options.follow,
        }).forEach((file) => {
            this.addGraphEntry(path.resolve(file))
        })
    }

    /**
     *
     * Refresh graph entry
     *
     * @param {string} filePath
     * @return {void}
     *
     */
    refreshGraphEntry(filePath) {
        this.addGraphEntry(filePath)
    }

    /**
     *
     * Add graph entry
     *
     * @param {string} filePath
     * @param {null|string} parent
     * @return {Object}
     *
     */
    addGraphEntry(filePath, parent = null) {
        if (this.options.exclude !== null && this.options.exclude.test(filePath)) {
            return
        }

        const entry = (this.index[filePath] = this.index[filePath] || {
            imports: [],
            importedBy: [],
            modified: fs.statSync(filePath).mtime,
        })

        let resolvedParent
        const isIndentedSyntax = path.extname(filePath) === '.sass'
        const imports = this.parseImports(fs.readFileSync(filePath, 'utf-8'), isIndentedSyntax)

        const cwd = path.dirname(filePath)

        for (let i = 0; i < imports.length; i++) {
            const loadPaths = [cwd, this.dir]
                .concat(this.loadPaths)
                .filter(Boolean)
                .filter((item, index, array) => array.indexOf(item) === index)
            const resolved = this.resolveSassPath(imports[i], loadPaths, this.options.extensions)
            if (!resolved) {
                continue
            }

            if (this.options.exclude !== null && this.options.exclude.test(resolved)) continue

            if (!entry.imports.includes(resolved)) {
                entry.imports.push(resolved)
                this.addGraphEntry(fs.realpathSync(resolved), filePath)
            }
        }

        if (parent) {
            resolvedParent = parent
            this.loadPaths.forEach((loadPath) => {
                if (parent.includes(loadPath)) {
                    resolvedParent = parent.substr(parent.indexOf(loadPath))
                }
            })

            if (!(this.options.exclude !== null && this.options.exclude.test(resolvedParent))) {
                entry.importedBy.push(resolvedParent)
            }
        }
    }

    /**
     *
     * Resolve Sass path
     *
     * @param {string} sassPath
     * @param {[]} loadPaths
     * @param {string[]} extensions
     * @return {string|boolean}
     *
     */
    resolveSassPath(sassPath, loadPaths, extensions) {
        const re = new RegExp(`(.(${extensions.join('|')}))$`, 'i')
        const sassPathName = sassPath.replace(re, '')
        for (let i = 0; i < loadPaths.length; i++) {
            for (let j = 0; j < extensions.length; j++) {
                const scssPath = path.normalize(`${loadPaths[i]}/${sassPathName}.${extensions[j]}`)

                if (fs.existsSync(scssPath) && fs.lstatSync(scssPath).isFile()) {
                    return scssPath
                }
            }

            for (let j = 0; j < extensions.length; j++) {
                const scssPath = path.normalize(`${loadPaths[i]}/${sassPathName}.${extensions[j]}`)
                const partialPath = path.join(path.dirname(scssPath), `_${path.basename(scssPath)}`)

                if (fs.existsSync(partialPath) && fs.lstatSync(partialPath).isFile()) {
                    return partialPath
                }
            }
        }

        return false
    }

    /**
     *
     * Resolve Sass path
     *
     * @param {string} content
     * @param {boolean} isIndentedSyntax
     * @return {[]}
     *
     */
    parseImports(content, isIndentedSyntax) {
        const tokens = tokenizer.tokenize(content)

        const results = []
        let tmp = ''
        let inImport = false
        let inParen = false
        let prevToken = tokens[0]

        for (let i = 1; i < tokens.length; i++) {
            const token = tokens[i]

            if (inImport && !inParen && token[0] === 'string') {
                results.push(token[1])
            } else if (
                (token[1] === 'import' || token[1] === 'use' || token[1] === 'forward') &&
                prevToken[1] === '@'
            ) {
                if (inImport && !isIndentedSyntax) {
                    throw new Error('Encountered invalid @import syntax.')
                }

                inImport = true
            } else if (inImport && !inParen && (token[0] === 'ident' || token[0] === '/')) {
                tmp += token[1]
            } else if (inImport && !inParen && (token[0] === 'space' || token[0] === 'newline')) {
                if (tmp !== '') {
                    results.push(tmp)
                    tmp = ''

                    if (isIndentedSyntax) {
                        inImport = false
                    }
                }
            } else if (inImport && token[0] === ';') {
                inImport = false

                if (tmp !== '') {
                    results.push(tmp)
                    tmp = ''
                }
            } else if (inImport && token[0] === '(') {
                inParen = true
                tmp = ''
            } else if (inImport && token[0] === ')') {
                inParen = false
            }

            prevToken = token
        }

        if (tmp !== '') {
            results.push(tmp)
        }

        return results
    }
}
