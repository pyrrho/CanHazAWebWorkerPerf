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

let resetState = (val) => {
    setStatusMessage("Initializing...")
    if (val) {
        g_elements.rx.innerHTML = val
        g_elements.tx.innerHTML = val
    } else {
        g_elements.rx.innerHTML = '0'
        g_elements.tx.innerHTML = '0'
    }
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
    g_vectCount = parseInt(e.target.value, 10)
    g_elements.vectCountBytes.innerHTML = humanReadableBytes(g_vectCount * 4 * 64)
})
g_elements.vectsPerBatch.addEventListener('input', (e) => {
    g_vectsPerBatch = parseInt(e.target.value, 10)
    g_elements.vectsPerBatchBytes.innerHTML = humanReadableBytes(g_vectsPerBatch * 4 * 64)
})
g_elements.buttons.clearOutput.addEventListener('click', () => {
    g_elements.output.value = ""
})

// Primary runners
g_elements.buttons.runListOfListsInPlace.addEventListener('click', () => {
    if (g_running) { return }
    resetState('n/a')
    setTimeout(listOfListsInPlace.start, 0, g_vectCount)
})

g_elements.buttons.runListOfListsSend.addEventListener('click', () => {
    if (g_running) { return }
    resetState()
    setTimeout(listOfListsSend.start, 0, g_vectCount, g_vectsPerBatch, g_workerCount)
})

g_elements.buttons.runListOfF64AInPlace.addEventListener('click', () => {
    if (g_running) { return }
    resetState('n/a')
    setTimeout(listOfF64AInPlace.start, 0, g_vectCount)
})

g_elements.buttons.runListOfF64ASend.addEventListener('click', () => {
    if (g_running) { return }
    resetState()
    setTimeout(listOfF64ASend.start, 0, g_vectCount, g_vectsPerBatch, g_workerCount)
})

g_elements.buttons.runListOfBatchesSend.addEventListener('click', () => {
    if (g_running) { return }
    resetState()
    setTimeout(listOfBatchesSend.start, 0, g_vectCount, g_vectsPerBatch, g_workerCount)
})



// List Of Lists In-Place
// ----------------------
let listOfListsInPlace = (() => {
    let listOfListsInPlace = {}

    let l_vects = []

    listOfListsInPlace.start = (vectCount) => {
        for (let i = 0; i < vectCount; i++) {
            l_vects.push(Float64Array.from([
                randBetween(0, 1000),
                randBetween(0, 1000),
                randBetween(0, 1000),
                1,
            ]).buffer)
        }

        runStart()
        setStatusMessage(`Processing buffers...`)
        g_elements.tx.innerHTML = 'n/a'
        g_elements.rx.innerHTML = 'n/a'
        setTimeout(listOfListsInPlace.processBuffers, 0)
    }

    listOfListsInPlace.processBuffers = () => {
        for (let i = 0, l = l_vects.length; i < l; i++) {
            // This constructor creates a new view, not a new array.
            // I wOnDeR wHy It'S sO fAsT?
            l_vects[i] = transform(l_vects[i])
        }

        runFinish()
        setTimeout(listOfListsInPlace.finish)
    }

    listOfListsInPlace.finish = () => {
        g_elements.output.value += (
            `number of list[4] vectors: ${l_vects.length} ` +
            '\n' +
            `\t${runDuration().toFixed(2)}ms\n`
        )

        l_vects = []
    }

    return listOfListsInPlace
})()

// List Of Float64Array[4] Send
// ----------------------------
let listOfListsSend = (() => {
    let listOfListsSend = {}

    let l_vects = []
    let l_vectsPerBatch = 0
    let l_workers = []

    let l_vectsSent = 0
    let l_vectsReceived = 0

    listOfListsSend.start = (vectCount, vectsPerBatch, workerCount) => {
        // TODO: Input validation
        // assert 0 <  vectCount
        // assert 0 <  vectsPerBatch <= vectCount
        // assert 0 <  workerCount

        l_vectsPerBatch = vectsPerBatch

        // Dynamically build the array of 1x4 vectors
        for (let i = 0; i < vectCount; i++) {
            l_vects.push([
                randBetween(0, 1000),
                randBetween(0, 1000),
                randBetween(0, 1000),
                1,
            ])
        }

        // Setup workers
        for (let i = 0; i < workerCount; i++) {
            let w = new Worker('worker_lolists.js')
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
                    //     vects: [ ArrayBuffer, ... ],
                    //     start:   Number,
                    //     end:     Number,
                    // }
                    let bufs = msg.data.vects
                    for (let i = 0, l = bufs.length; i < l; i++) {
                        l_vects[i + msg.data.start] = bufs[i]
                    }
                    listOfListsSend.markReceived(msg.data.end - msg.data.start)
                    break
                default:
                    console.error(`Received a message I don't know what to do with: ${JSON.stringify(msg.data)}`)
                    break
            }
        }

        runStart()
        setStatusMessage(`Transmitting batched vectors...`)
        setTimeout(listOfListsSend.transmitBatches, 0, 0)
    }

    listOfListsSend.transmitBatches = (index) => {
        for (let j = 0, l = l_workers.length; j < l; j++) {
            if (index === l_vects.length) { return } // early out

            const start = index
            const end = index + l_vectsPerBatch
            const vects = l_vects.slice(start, end)
            const count = vects.length

            l_workers[j].postMessage(
                {
                    type: 'transform',
                    vects: vects,
                    start: start,
                    end: start + count,
                },
            )

            index += count
            listOfListsSend.markSent(count)
        }

        if (index !== l_vects.length) {
            setTimeout(listOfListsSend.transmitBatches, 0, index)
        }
    }

    listOfListsSend.markSent = (count) => {
        l_vectsSent += count
        g_elements.tx.innerHTML = l_vectsSent
    }

    listOfListsSend.markReceived = (count) => {
        l_vectsReceived += count
        g_elements.rx.innerHTML = l_vectsReceived

        if (l_vectsReceived === l_vects.length) {
            listOfListsSend.finish()
        }
    }

    listOfListsSend.finish = () => {
        runFinish()

        g_elements.output.value += (
            `number of list[4] vectors: ${l_vects.length} ` +
            `-- vectors per batch: ${l_vectsPerBatch} ` +
            `-- worker count: ${l_workers.length}` +
            `\n` +
            `\t${runDuration().toFixed(2)}ms\n`
        )

        for (let i = 0, l = l_workers.length; i < l; i++) {
            l_workers[i].terminate()
        }

        l_workers = []
        l_vectsSent = 0
        l_vectsReceived = 0
        l_vects = []
    }

    return listOfListsSend
})()

// List Of Float64Array[4] In-Place
// --------------------------------
let listOfF64AInPlace = (() => {
    let listOfF64AInPlace = {}

    let l_buffers = []

    listOfF64AInPlace.start = (vectCount) => {
        for (let i = 0; i < vectCount; i++) {
            l_buffers.push(Float64Array.from([
                randBetween(0, 1000),
                randBetween(0, 1000),
                randBetween(0, 1000),
                1,
            ]).buffer)
        }

        runStart()
        setStatusMessage(`Processing buffers...`)
        g_elements.tx.innerHTML = 'n/a'
        g_elements.rx.innerHTML = 'n/a'
        setTimeout(listOfF64AInPlace.processBuffers, 0)
    }

    listOfF64AInPlace.processBuffers = () => {
        for (let i = 0, l = l_buffers.length; i < l; i++) {
            // This constructor creates a new view, not a new array.
            // I wOnDeR wHy It'S sO fAsT?
            let a = new Float64Array(l_buffers[i])
            a.set(transform(a))
        }

        runFinish()
        setTimeout(listOfF64AInPlace.finish)
    }

    listOfF64AInPlace.finish = () => {
        g_elements.output.value += (
            `number of Float64Arrays[4]s: ${l_buffers.length} ` +
            '\n' +
            `\t${runDuration().toFixed(2)}ms\n`
        )

        l_buffers = []
    }

    return listOfF64AInPlace
})()

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
            let w = new Worker('worker_lof64a.js')
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
        setStatusMessage(`Transmitting batched buffers...`)
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
                    end: start + count,
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
            `number of Float64Array[4] buffers: ${l_buffers.length} ` +
            `-- buffers per batch: ${l_buffersPerBatch} ` +
            `-- worker count: ${l_workers.length}` +
            `\n` +
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

// List Of Float64Array[4*Vectors per Batch] Send
// ----------------------------------------------
let listOfBatchesSend = (() => {
    let listOfBatchesSend = {}

    let l_vectCount = 0
    let l_buffers = []
    let l_vectsPerBatch = 0
    let l_workers = []

    let l_vectsSent = 0
    let l_vectsReceived = 0

    listOfBatchesSend.start = (vectCount, vectsPerBatch, workerCount) => {
        l_vectCount = vectCount
        l_vectsPerBatch = vectsPerBatch

        let bufferCount = vectCount / vectsPerBatch
        for (let i = 0; i < bufferCount; i++) {
            // The last buffer may be shorter than the rest;
            let vectsCreated = (i * vectsPerBatch)
            let vectsLeft = vectCount - vectsCreated
            let arrayLen = Math.min(vectsPerBatch, vectsLeft)

            let fbuf = new Float64Array(4 * arrayLen)
            for (let j = 0, l = fbuf.length; j < l; j += 4) {
                fbuf[j + 0] = randBetween(0, 1000)
                fbuf[j + 1] = randBetween(0, 1000)
                fbuf[j + 2] = randBetween(0, 1000)
                fbuf[j + 3] = 1
            }

            l_buffers.push(fbuf.buffer)
        }

        // Setup workers
        for (let i = 0; i < workerCount; i++) {
            let w = new Worker('worker_lobatches.js')
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
                    //     type:   'transformed',
                    //     buffer: ArrayBuffer,
                    //     index:  Number,
                    //     count:  Number,
                    // }
                    l_buffers[msg.data.index] = msg.data.buffer
                    listOfBatchesSend.markReceived(msg.data.count)
                    break
                default:
                    console.error(`Received a message I don't know what to do with: ${JSON.stringify(msg.data)}`)
                    break
            }
        }

        runStart()
        setStatusMessage(`Transmitting batched buffers...`)
        setTimeout(listOfBatchesSend.transmitBatches, 0, 0)
    }

    listOfBatchesSend.transmitBatches = (index) => {
        let bufferCount = l_buffers.length;

        for (let j = 0, l = l_workers.length; j < l; j++) {
            if (index === bufferCount) { return } // early out
            let vectsInBuffer = (new Float64Array(l_buffers[index])).length / 4

            l_workers[j].postMessage(
                {
                    type: 'transform',
                    buffer: l_buffers[index],
                    index: index,
                    count: vectsInBuffer,
                },
                [l_buffers[index]],
            )

            index += 1
            listOfBatchesSend.markSent(vectsInBuffer)
        }

        if (index !== bufferCount) {
            setTimeout(listOfBatchesSend.transmitBatches, 0, index)
        }
    }

    listOfBatchesSend.markSent = (count) => {
        l_vectsSent += count
        g_elements.tx.innerHTML = l_vectsSent
    }

    listOfBatchesSend.markReceived = (count) => {
        l_vectsReceived += count
        g_elements.rx.innerHTML = l_vectsReceived

        if (l_vectsReceived === l_vectCount) {
            listOfBatchesSend.finish()
        }
    }

    listOfBatchesSend.finish = () => {
        runFinish()

        g_elements.output.value += (
            `number of Float64Arrays[4 * Vectors per Buffer] buffers: ${l_buffers.length} ` +
            `-- vectors per buffer: ${l_vectsPerBatch} ` +
            `-- worker count: ${l_workers.length}` +
            `\n` +
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

    return listOfBatchesSend
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

    return ret
}
