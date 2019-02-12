"use strict"

// Global HTML elements
const g_elements = {
    state: document.querySelector('#state'),
    tx: document.querySelector('#vectTx'),
    rx: document.querySelector('#vectRx'),
    vectCount: document.querySelector('#vectCount'),
    batchSize: document.querySelector('#batchSize'),
    workerCount: document.querySelector('#workerCount'),
    output: document.querySelector('#output'),
}

// Global variables
// WHAT A GREAT IDEA!!!1!
let g_running = false

let g_vectCount = 0
let g_batchSize = 0
let g_workerCount = 0

let g_startTime = 0
let g_endTime = 0

let g_reset = () => {
    g_vectCount = 0
    g_batchSize = 0
    g_workerCount = 0

    g_startTime = 0
    g_endTime = 0
}

let readConfigs = () => {
    g_vectCount = parseInt(g_elements.vectCount.value, 10)
    g_batchSize = parseInt(g_elements.batchSize.value, 10)
    g_workerCount = parseInt(g_elements.workerCount.value, 10)
}

let resetState = () => {
    g_elements.state.innerHTML = `Initializing...`
    g_elements.tx.innerHTML = 0
    g_elements.rx.innerHTML = 0
}

// On Click event listeners
document
    .querySelector('#run_lol_inplace')
    .addEventListener('click', () => {
        if (g_running) { return }
        console.log("Starting List of Lists In-Place")
        resetState()
        readConfigs()
    })

document
    .querySelector('#run_lol_send')
    .addEventListener('click', () => {
        if (g_running) { return }
        console.log("Starting List of Lists with Web Workers")
        resetState()
        readConfigs()
    })

document
    .querySelector('#run_lofa_inplace')
    .addEventListener('click', () => {
        if (g_running) { return }
        console.log("Starting List of FloatArray[4] In-Place")
        resetState()
        readConfigs()
    })

document
    .querySelector('#run_lofa_send')
    .addEventListener('click', () => {
        if (g_running) { return }
        console.log("Starting List of FloatArray[4] with Web Workers")
        resetState()
        readConfigs()
        setTimeout(lofa.start)
    })

document
    .querySelector('#run_lobatches_send')
    .addEventListener('click', () => {
        if (g_running) { return }
        console.log("Starting List of Batched FloatArray[4*BatchSize]")
        resetState()
        readConfigs()
    })

document
    .querySelector('#run_single_fa')
    .addEventListener('click', () => {
        if (g_running) { return }
        console.log("Starting Single FloatArray[4*VectorCount]")
        resetState()
        readConfigs()
    })



// List Of Float64Arrays
// ---------------------
let lofa = (() => {
    let lofa = {}

    let l_workers = []
    let l_buffersLen = 0
    let l_sent = 0
    let l_received = 0
    let l_buffers = []

    let l_reset = () => {
        for (let i = 0, l = l_workers.length; i < l; i++) {
            l_workers[i].terminate()
        }

        l_workers = []
        l_sent = 0
        l_received = 0
        l_buffers = []
    }

    lofa.start = () => {
        // TODO: Input validation
        // assert 0 <  g_vectCount
        // assert 0 <  g_batchSize <= g_vectCount
        // assert 0 <  g_workerCount

        // Dynamically build the array of 1x4 vectors
        for (let i = 0; i < g_vectCount; i++) {
            l_buffers.push(Float64Array.from([
                randBetween(0, 1000),
                randBetween(0, 1000),
                randBetween(0, 1000),
                1,
            ]).buffer)
        }
        l_buffersLen = l_buffers.length

        // Setup workers
        for (let i = 0; i < g_workerCount; i++) {
            l_workers.push(new Worker('worker.js'))
            let last = l_workers.length - 1
            l_workers[last].onmessage = lofaWorkerOnMessage
            l_workers[last].postMessage({ type: 'ping' })
        }
        function lofaWorkerOnMessage(msg) {
            switch (msg.data.type) {
                case 'pong':
                    //noop
                    break
                case 'transformed':
                    for (let i = 0, l = msg.data.buffers.length; i < l; i++) {
                        l_buffers[i + msg.data.start] = msg.data.buffers[i]
                    }
                    markReceived(msg.data.end - msg.data.start)
                    break
                default:
                    console.error(`Received a message I don't know what to do with: ${JSON.stringify(msg.data)}`)
                    break
            }
        }

        // The general case;
        g_elements.state.innerHTML = `Transmitting Batched buffers...`
        g_startTime = performance.now()

        setTimeout(transmitBatches, 0, 0, g_batchSize)
    }

    function transmitBatches(index, batchSize) {
        for (
            let j = 0, l = l_workers.length; j < l; j++) {
            if (index === l_buffersLen) { return } // early out

            const start = index
            const end = index + g_batchSize
            const buffers = l_buffers.slice(start, end)
            const count = buffers.length

            l_workers[j].postMessage(
                {
                    type: 'transform',
                    buffers: buffers,
                    start: start,
                    end: end,
                },
                buffers,
            )

            index += count
            markSent(count)
        }

        if (index !== l_buffersLen) {
            setTimeout(transmitBatches, 0, index)
        }
    }

    function markSent(count) {
        l_sent += count
        g_elements.tx.innerHTML = l_sent
    }

    function markReceived(count) {
        l_received += count
        g_elements.rx.innerHTML = l_received

        if (l_received === l_buffersLen) {
            let duration = performance.now() - g_startTime

            g_elements.output.value += (
                `number of Float64Arrays: ${l_buffersLen} (${humanReadableBytes(l_buffersLen * 4 * 64)}) ` +
                `-- batch size: ${g_batchSize} (${humanReadableBytes(g_batchSize * 4 * 64)}) ` +
                `-- worker count: ${g_workerCount}\n` +
                `\t${duration.toFixed(2)}ms\n`
            )
            g_elements.state.innerHTML = 'Finished'

            l_reset()
            g_reset()
        }
    }

    return lofa
})()




function humanReadableBytes(n) {
    const size_suffixes = [
        'B',
        'KB',
        'MB',
        'GB',
    ]
    let s = 0
    while (n > 1000.0) {
        n /= 1024.
        s += 1
    }

    return `${n.toFixed(2)}${size_suffixes[s]}`

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
