'use strict'

// #####################################################################################################################

/**
 * @author Jakub Zasański <jakub.zasanski.dev@gmail.com>
 * @version 1.0.0
 */

// #####################################################################################################################

import chalk from 'chalk'
import log from 'fancy-log'
import path from 'node:path'
import process from 'node:process'
import sassGraph from './sass-graph.js'
import { Transform } from 'node:stream'
import { vinylFileSync } from 'vinyl-file'

let graph = {}

// #####################################################################################################################

/**
 *
 * Find dependency files in graph
 *
 * @param {string} file
 * @param {object} graph
 * @return {string[]}
 */
function getDependencyFiles(file, graph) {
    let dependencyFiles = []

    function _getDependencyFilesRecursive(file, graph, files) {
        files = files || []
        file = path.normalize(file)

        try {
            if (!isPartial(file)) {
                if (files.indexOf(file) === -1) {
                    files.push(file)
                }
            }

            if (graph.index[file].importedBy.length > 0) {
                graph.index[file].importedBy.forEach((file) => {
                    _getDependencyFilesRecursive(file, graph, files)
                })
                return files
            }

            return files
        } catch (e) {
            return []
        }
    }

    dependencyFiles = _getDependencyFilesRecursive(file, graph)
    dependencyFiles.sort()
    return dependencyFiles
}

/**
 *
 * Find dependency files in graph
 *
 * @param {string} filePath
 * @return {boolean}
 */
function isPartial(filePath) {
    return path.basename(filePath)[0] === '_'
}

/**
 *
 * Create Vinyl file from paths array
 *
 * @param {string[]} files
 * @param {string} base
 * @return {[]}
 */
function createVinylFileArray(files, base) {
    const filesArray = []

    files.forEach((file) => {
        filesArray.push(
            vinylFileSync(file, {
                base: base,
            }),
        )
    })

    return filesArray
}

/**
 *
 * Add dependent partials to transform stream
 *
 * @param {string} baseDir
 * @param {string} loadPaths
 * @return {Transform}
 */
function sassDependentPartials(baseDir, loadPaths) {
    baseDir = baseDir || './'
    loadPaths = loadPaths ? (Array.isArray(loadPaths) ? loadPaths : [loadPaths]) : [baseDir]

    return new Transform({
        objectMode: true,
        transform(file, encoding, callback) {
            if (file.isNull()) {
                callback(null, file)
                return
            }

            if (file.isStream()) {
                callback(null, file)
                return
            }

            if (Object.keys(graph).length === 0) {
                log(chalk.yellow(`Generating SASS files graph...`))
                graph = new sassGraph(baseDir, { loadPaths: loadPaths })
                graph.createGraph()
                log(chalk.yellow(`SASS graph is ready.`))
            } else {
                graph.refreshGraphEntry(file.path)
            }

            if (isPartial(file.path)) {
                const dependencyFiles = getDependencyFiles(file.path, graph)
                if (dependencyFiles.length > 0) {
                    const vinylFiles = createVinylFileArray(dependencyFiles, process.cwd())
                    if (vinylFiles) {
                        vinylFiles.forEach((vinylFile) => {
                            log(`Push file to stream ${chalk.green(vinylFile.path)}`)
                            this.push(vinylFile)
                        })
                    }
                }
            }

            callback(null, file)
        },
    })
}

export default sassDependentPartials
