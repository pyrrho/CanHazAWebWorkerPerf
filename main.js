"use strict"

// Global HTML elements
const g_elements = {
    state: document.querySelector('#state'),
    tx: document.querySelector('#stateTx'),
    rx: document.querySelector('#stateRx'),
    vectCount: document.querySelector('#vectCount'),
    vectCountBytes: document.querySelector('#vectCountBytes'),
    vectsPerBatch: document.querySelector('#vectsPerBatch'),
    vectsPerBatchBytes: document.querySelector('#vectsPerBatchBytes'),
    workerCount: document.querySelector('#workerCount'),
    output: document.querySelector('#output'),
    buttons: {
        clearOutput: document.querySelector('#clearOutput'),
        runListOfListsInPlace: document.querySelector('#run_lol_inplace'),
        runListOfListsSend: document.querySelector('#run_lol_send'),
        runListOfF64AInPlace: document.querySelector('#run_lofa_inplace'),
        runListOfF64ASend: document.querySelector('#run_lofa_send'),
        runListOfBatchesSend: document.querySelector('#run_lobatches_send'),
        runListOfSingleF64A: document.querySelector('#run_single_fa'),
    },
}

// Global variables
// WHAT A GREAT IDEA!!!1!
let g_running = false

let g_vectCount = parseInt(g_elements.vectCount.value, 10)
let g_vectsPerBatch = parseInt(g_elements.vectsPerBatch.value, 10)
let g_workerCount = parseInt(g_elements.workerCount.value, 10)

let g_startTime = 0
let g_endTime = 0

g_elements.vectCountBytes.innerHTML = humanReadableBytes(g_vectCount * 4 * 64)
g_elements.vectsPerBatchBytes.innerHTML = humanReadableBytes(g_vectsPerBatch * 4 * 64)

let setStatusMessage = (msg) => {
    g_elements.state.innerHTML = msg
}

let resetState = () => {
    setStatusMessage(`Initializing...`)
    g_elements.tx.innerHTML = 0
    g_elements.rx.innerHTML = 0
}

let runStart = () => {
    g_running = true
    g_startTime = performance.now()
}
let runFinish = () => {
    g_endTime = performance.now()
    setStatusMessage('Finished')
    g_running = false
}
let runDuration = () => {
    return g_endTime - g_startTime
}

g_elements.vectCount.addEventListener('input', (e) => {
    g_vectCount = e.target.value
    g_elements.vectCountBytes.innerHTML = humanReadableBytes(g_vectCount * 4 * 64)
})
g_elements.vectsPerBatch.addEventListener('input', (e) => {
    g_vectsPerBatch = e.target.value
    g_elements.vectsPerBatchBytes.innerHTML = humanReadableBytes(g_vectsPerBatch * 4 * 64)
})
g_elements.buttons.clearOutput.addEventListener('click', () => {
    g_elements.output.value = ""
})

// Primary runners
g_elements.buttons.runListOfListsInPlace.addEventListener('click', () => {
    if (g_running) { return }
    console.log("Starting List of Lists In-Place")
    g_running = false
})

g_elements.buttons.runListOfListsSend.addEventListener('click', () => {
    if (g_running) { return }
    console.log("Starting List of Lists with Web Workers")
    g_running = false
})

g_elements.buttons.runListOfF64AInPlace.addEventListener('click', () => {
    if (g_running) { return }
    console.log("Starting List of FloatArray[4] In-Place")
    g_running = false
})

g_elements.buttons.runListOfF64ASend.addEventListener('click', () => {
    if (g_running) { return }
    setStatusMessage("Initializing...")
    setTimeout(listOfF64ASend.start, 0, g_vectCount, g_vectsPerBatch, g_workerCount)
})

g_elements.buttons.runListOfBatchesSend.addEventListener('click', () => {
    if (g_running) { return }
    console.log("Starting List of Batched FloatArray[4*vectsPerBatch]")
    g_running = false
})

g_elements.buttons.runListOfSingleF64A.addEventListener('click', () => {
    if (g_running) { return }
    console.log("Starting Single FloatArray[4*VectorCount]")
    g_running = false
})



// List Of Float64Array[4] Send
// ----------------------------
let listOfF64ASend = (() => {
    let listOfF64ASend = {}

    let l_buffers = []
    let l_buffersPerBatch = 0
    let l_workers = []

    let l_vectsSent = 0
    let l_vectsReceived = 0

    listOfF64ASend.start = (vectCount, vectsPerBatch, workerCount) => {
        // TODO: Input validation
        // assert 0 <  vectCount
        // assert 0 <  vectsPerBatch <= vectCount
        // assert 0 <  workerCount

        l_buffersPerBatch = vectsPerBatch

        // Dynamically build the array of 1x4 vectors
        for (let i = 0; i < vectCount; i++) {
            l_buffers.push(Float64Array.from([
                randBetween(0, 1000),
                randBetween(0, 1000),
                randBetween(0, 1000),
                1,
            ]).buffer)
        }

        // Setup workers
        for (let i = 0; i < workerCount; i++) {
            let w = new Worker('worker.js')
            w.onmessage = workerOnMessage
            w.postMessage({ type: 'ping' })

            l_workers.push(w)
        }
        function workerOnMessage(msg) {
            switch (msg.data.type) {
                case 'pong':
                    //noop
                    break
                case 'transformed':
                    // msg.data: {
                    //     type:    'transformed',
                    //     buffers: [ ArrayBuffer, ... ],
                    //     start:   Number,
                    //     end:     Number,
                    // }
                    let bufs = msg.data.buffers
                    for (let i = 0, l = bufs.length; i < l; i++) {
                        l_buffers[i + msg.data.start] = bufs[i]
                    }
                    listOfF64ASend.markReceived(msg.data.end - msg.data.start)
                    break
                default:
                    console.error(`Received a message I don't know what to do with: ${JSON.stringify(msg.data)}`)
                    break
            }
        }

        runStart()
        setStatusMessage(`Transmitting Batched buffers...`)
        setTimeout(listOfF64ASend.transmitBatches, 0, 0)
    }

    listOfF64ASend.transmitBatches = (index) => {
        for (let j = 0, l = l_workers.length; j < l; j++) {
            if (index === l_buffers.length) { return } // early out

            const start = index
            const end = index + l_buffersPerBatch
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
            listOfF64ASend.markSent(count)
        }

        if (index !== l_buffers.length) {
            setTimeout(listOfF64ASend.transmitBatches, 0, index)
        }
    }

    listOfF64ASend.markSent = (count) => {
        l_vectsSent += count
        g_elements.tx.innerHTML = l_vectsSent
    }

    listOfF64ASend.markReceived = (count) => {
        l_vectsReceived += count
        g_elements.rx.innerHTML = l_vectsReceived

        if (l_vectsReceived === l_buffers.length) {
            listOfF64ASend.finish()
        }
    }

    listOfF64ASend.finish = () => {
        runFinish()

        g_elements.output.value += (
            `number of Float64Arrays buffers: ${l_buffers.length} ` +
            `-- buffers per batch: ${l_buffersPerBatch} ` +
            `-- worker count: ${l_workers.length}\n` +
            `\t${runDuration().toFixed(2)}ms\n`
        )

        for (let i = 0, l = l_workers.length; i < l; i++) {
            l_workers[i].terminate()
        }

        l_workers = []
        l_vectsSent = 0
        l_vectsReceived = 0
        l_buffers = []
    }

    return listOfF64ASend
})()




function humanReadableBytes(n) {
    const size_suffixes = [
        'B',
        'KiB',
        'MiB',
        'GiB',
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
