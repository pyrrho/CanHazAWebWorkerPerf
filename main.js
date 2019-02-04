"use strict"

const g_vectTxElement = document.getElementById("vectTx")
const g_vectRxElement = document.getElementById("vectRx")
const g_stateElement = document.getElementById("state")
const g_runsElement = document.getElementById("runs")

let g_vectCount = 0
let g_batchSize = 0
let g_workerCount = 0

let g_buffers = null
let g_workers = []

let g_startTime = 0
let g_replaced = 0

function g_reset() {
    for (let i = 0; i < g_workerCount; i++) {
        g_workers[i].terminate()
    }

    g_vectCount = 0
    g_batchSize = 0
    g_workerCount = 0

    g_buffers = null
    g_workers = []

    g_startTime = 0
    g_replaced = 0
}


// Fetch the worker tag's text, turn that into a blob, generate the URL of that
// blob, then use that blob to generate a web-worker.
const workerScript = document.getElementById("worker")
const workerText = workerScript.innerText
const workerBlob = new Blob([workerText], { type: 'application/json' })
const workerBlobURL = URL.createObjectURL(workerBlob)

document
    .getElementById('run')
    .addEventListener('click', () => {
        g_stateElement.innerHTML = `Initializing...`
        g_vectTxElement.innerHTML = 0
        g_vectRxElement.innerHTML = 0

        g_vectCount = parseInt(document.getElementById('vectCount').value, 10)
        g_batchSize = parseInt(document.getElementById('batchSize').value, 10)
        g_workerCount = parseInt(document.getElementById('workerCount').value, 10)

        // TODO: Input validation
        // assert 0 <  g_vectCount
        // assert 0 <  g_batchSize <= g_vectCount
        // assert 0 <= g_workerCount

        setTimeout(Initialize)
    })

function Initialize() {
    // Dynamically build the array of 1x4 vectors
    g_buffers = new Array(g_vectCount)
    for (let i = 0; i < g_vectCount; i++) {
        g_buffers[i] = Float64Array.from([
            randBetween(0, 1000),
            randBetween(0, 1000),
            randBetween(0, 1000),
            1,
        ]).buffer
    }

    // If we're single-threaded (no workers) perform an in-place mutation
    if (g_workerCount === 0) {
        g_stateElement.innerHTML = `Single-threaded mutations...`
        setTimeout(mutateInPlace())
        return
    }

    // If we're using workers, set them up
    g_workers = new Array(g_workerCount)
    for (let i = 0; i < g_workerCount; i++) {
        g_workers[i] = new Worker(workerBlobURL)
        g_workers[i].onmessage = workerOnMessage
        g_workers[i].postMessage({ type: 'hello', msg: "making sure you're warm" })
    }

    // If we're not batching (the batch size is 1) try to optimize posting
    if (g_batchSize === 1) {
        g_stateElement.innerHTML = `Transmitting individual buffers...`
        g_vectTxElement.innerHTML = '...'

        setTimeout(transmitForEach)
        return
    }

    // The general case;
    g_stateElement.innerHTML = `Transmitting Batched buffers...`
    g_startTime = performance.now()

    setTimeout(transmitBatches, 0, 0)
}

function mutateInPlace() {
    console.log(`starting with ${new Float64Array(g_buffers[0])}`)
    g_startTime = performance.now()

    g_buffers.forEach(e => {
        let a = new Float64Array(e)
        transform(a)
    })
    g_vectTxElement.innerHTML = g_vectCount

    setTimeout(markReplaced, 0, g_vectCount)
    console.log(`ending with ${new Float64Array(g_buffers[0])}`)
}

function transmitForEach() {
    g_startTime = performance.now()

    g_buffers.forEach((e, i) => {
        g_workers[i % g_workerCount].postMessage(
            {
                type: 'transform_one',
                buffer: e,
                index: i,
            },
            [e],
        )
    })
    g_vectTxElement.innerHTML = g_vectCount
}

function transmitBatches(index) {
    for (let j = 0; j < g_workerCount; j++) {
        const start = index
        const end = index + g_batchSize
        const buffers = g_buffers.slice(start, end)
        // Early out
        if (buffers.length === 0) {
            g_vectTxElement.innerHTML = index
            return
        }
        g_workers[j].postMessage(
            {
                type: 'transform',
                buffers: buffers,
                start: start,
                end: end,
            },
            buffers,
        )
        index = end
    }
    g_vectTxElement.innerHTML = index

    if (index != g_vectCount) {
        setTimeout(transmitBatches, 0, index)
    }
}

function workerOnMessage(msg) {
    switch (msg.data.type) {
        case 'transformed':
            for (var i = 0; i < msg.data.buffers.length; i++) {
                g_buffers[i + msg.data.start] = msg.data.buffers[i]
            }
            markReplaced(msg.data.end - msg.data.start)
            break
        case 'transformed_one':
            g_buffers[msg.data.index] = msg.data.buffer
            markReplaced(1)
            break
        default:
            console.error(`Received a message I don't know what to do with: ${JSON.stringify(msg.data)}`)
            break
    }
}

function markReplaced(count) {
    g_replaced += count
    g_vectRxElement.innerHTML = g_replaced

    if (g_replaced === g_vectCount) {
        let duration = performance.now() - g_startTime

        g_runsElement.value += (
            `vect count: ${g_vectCount} -- batch size: ${g_batchSize} -- worker count: ${g_workerCount}\n` +
            `\t\t${duration}ms\n`
        )
        g_stateElement.innerHTML = "Finished"

        g_reset()
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

    v.set(ret)
}
