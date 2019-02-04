"use strict"

const g_runsElement = document.getElementById("runs")

let g_vects = []
let g_replaced = 0
let g_vecCount = 0
let g_batchSize = 0
let g_startTime = 0


// Fetch the worker tag's text, turn that into a blob, generate the URL of that
// blob, then use that blob to generate a web-worker.
const workerLink = document.getElementById("worker")
const workerText = workerLink.import.body.innerText
const workerBlob = new Blob([workerText], { type: 'application/json' })
const workerBlobURL = URL.createObjectURL(workerBlob)

const g_worker = new Worker(workerBlobURL)
g_worker.onmessage = msg => {
    const data = msg.data
    switch (data.type) {
        case 'transformed':
            for (var i = 0; i < data.vects.length; i++) {
                g_vects[i + data.start] = data.vects[i]
            }
            markReplaced(data.end - data.start)
            break;
        default:
            alert(`Received a message I don't know what to do with: ${JSON.stringify(msg)}`)
            break;
    }
}

document
    .getElementById('run')
    .addEventListener('click', () => {
        g_replaced = 0
        g_vects = []
        g_vecCount = parseInt(document.getElementById('vecCount').value, 10)
        g_batchSize = parseInt(document.getElementById('batchSize').value, 10)

        Array.from(Array(g_vecCount).keys()).forEach(_ => {
            g_vects.push([randBetween(0, 1000), randBetween(0, 1000), randBetween(0, 1000), 1])
        })

        g_startTime = performance.now()

        if (g_batchSize == 0) {
            g_vects.map(transform)
            markReplaced(g_vecCount)
        } else {
            for (var i = 0; i < g_vects.length; i += g_batchSize) {
                const start = i
                const end = i + g_batchSize
                g_worker.postMessage({
                    type: 'transform',
                    start: start,
                    end: end,
                    vects: g_vects.slice(start, end)
                })
            }

        }


    })

function markReplaced(count) {
    g_replaced += count

    if (g_replaced > g_vecCount) {
        alert(`Off By One error somewhere!(${g_vecCount}, ${replaced})`)
    } else if (g_replaced == g_vecCount) {
        let duration = performance.now() - g_startTime
        g_runsElement.value +=
            `${g_vecCount} vectors batched into chunks of ${g_batchSize} each\n` +
            `\t\t${duration}ms\n`
    }
}

function randBetween(min, max) {
    return Math.random() * (+max - +min) + +min
}

// Duplicated from worker.js, and not split out into a module.
// Because I am _lazy_.
const TRANSFORM = [
    [0.1527236, -0.9116594, 0.3815136, 4.0000000],
    [0.9756048, 0.2006826, 0.0890043, -7.5000000],
    [-0.1577047, 0.3586135, 0.9200683, 3.2000000],
    [0.0000000, 0.0000000, 0.0000000, 1.0000000],
]

function transform(v) {
    let ret = [0, 0, 0, 0]
    ret[0] = (v[0] * TRANSFORM[0][0]) + (v[1] * TRANSFORM[0][1]) + (v[2] * TRANSFORM[0][2]) + (v[3] * TRANSFORM[0][3])
    ret[1] = (v[0] * TRANSFORM[1][0]) + (v[1] * TRANSFORM[1][1]) + (v[2] * TRANSFORM[1][2]) + (v[3] * TRANSFORM[1][3])
    ret[2] = (v[0] * TRANSFORM[2][0]) + (v[1] * TRANSFORM[2][1]) + (v[2] * TRANSFORM[2][2]) + (v[3] * TRANSFORM[2][3])
    ret[3] = (v[0] * TRANSFORM[3][0]) + (v[1] * TRANSFORM[3][1]) + (v[2] * TRANSFORM[3][2]) + (v[3] * TRANSFORM[3][3])
    return ret
}
