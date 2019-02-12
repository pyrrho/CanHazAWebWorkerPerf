"use strict"

const g_LOFAElements = {
    vectTx: document.querySelector("#vectTx"),
    vectRx: document.querySelector("#vectRx"),
    state: document.querySelector("#state"),
    runs: document.querySelector("#runs"),
    vectCount: document.getElementById('vectCount'),
    batchSize: document.getElementById('batchSize'),
    workerCount: document.getElementById('workerCount'),
}

let g_running = false

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

    g_running = false
}

function humanReadableBytes(n) {
    const size_suffixes = [
        "B",
        "KB",
        "MB",
        "GB",
    ]
    let s = 0
    while (n > 1000.0) {
        n /= 1024.
        s += 1
    }

    return `${n.toFixed(2)}${size_suffixes[s]}`

}


document
    .getElementById('run')
    .addEventListener('click', () => {
        if (g_running) { return }
        g_running = true

        g_LOFAElements.state.innerHTML = `Initializing...`
        g_LOFAElements.vectTx.innerHTML = 0
        g_LOFAElements.vectRx.innerHTML = 0

        g_vectCount = parseInt(g_LOFAElements.vectCount.value, 10)
        g_batchSize = parseInt(g_LOFAElements.batchSize.value, 10)
        g_workerCount = parseInt(g_LOFAElements.workerCount.value, 10)

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
        g_LOFAElements.state.innerHTML = `Single-threaded mutations...`
        setTimeout(mutateInPlace())
        return
    }

    // If we're using workers, set them up
    g_workers = new Array(g_workerCount)
    for (let i = 0; i < g_workerCount; i++) {
        g_workers[i] = new Worker('worker.js')
        g_workers[i].onmessage = workerOnMessage
        g_workers[i].postMessage({ type: 'hello', msg: "making sure you're warm" })
    }

    // If we're not batching (the batch size is 1) try to optimize how we post
    // TODO: We don't. This isn't optimized at all.
    if (g_batchSize === 1) {
        g_LOFAElements.state.innerHTML = `Transmitting individual buffers...`
        g_LOFAElements.vectTx.innerHTML = '...'

        setTimeout(transmitForEach)
        return
    }
    // If we're sending the whole batch over in one go (batch size === vect
    // count) try to optize that.
    // TODO: It's not. It's not optimized. It's so slow...
    if (g_batchSize == g_vectCount) {
        g_LOFAElements.state.innerHTML = `Transmitting as one buffer...`
        g_LOFAElements.vectTx.innerHTML = '...'

        setTimeout(transmitAll)
        return
    }

    // The general case;
    g_LOFAElements.state.innerHTML = `Transmitting Batched buffers...`
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
    g_LOFAElements.vectTx.innerHTML = g_vectCount

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
    g_LOFAElements.vectTx.innerHTML = g_vectCount
}

function transmitAll() {
    g_startTime = performance.now()

    console.log('hi')
    g_workers[0].postMessage(
        {
            type: 'transform',
            buffers: g_buffers,
            start: 0,
            end: g_vectCount,
        },
        g_buffers,
    )
    console.log('bye')
    g_LOFAElements.vectTx.innerHTML = g_vectCount
}

function transmitBatches(index) {
    for (let j = 0; j < g_workerCount; j++) {
        const start = index
        const end = index + g_batchSize
        const buffers = g_buffers.slice(start, end)
        // Early out
        if (buffers.length === 0) {
            g_LOFAElements.vectTx.innerHTML = index
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
    g_LOFAElements.vectTx.innerHTML = index

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
    g_LOFAElements.vectRx.innerHTML = g_replaced

    if (g_replaced === g_vectCount) {
        let duration = performance.now() - g_startTime

        g_LOFAElements.runs.value += (
            `number of Float64Arrays: ${g_vectCount} (${humanReadableBytes(g_vectCount * 4 * 64)}) ` +
            `-- batch size: ${g_batchSize} (${humanReadableBytes(g_batchSize * 4 * 64)}) ` +
            `-- worker count: ${g_workerCount}\n` +
            `\t${duration.toFixed(2)}ms\n`
        )
        g_LOFAElements.state.innerHTML = "Finished"

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
