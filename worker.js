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

self.onmessage = function (m) {
    switch (m.data.type) {
        case ('ping'):
            self.postMessage(
                {
                    type: 'pong',
                },
            )
            break
        case ('transform'):
            m.data.buffers.forEach(e => {
                let a = new Float64Array(e)
                transform(a)
            })
            self.postMessage(
                {
                    type: 'transformed',
                    start: m.data.start,
                    end: m.data.end,
                    buffers: m.data.buffers,
                },
                m.data.buffers,
            )
            break
        case ('transform_one'):
            let a = new Float64Array(m.data.buffer)
            transform(a)
            self.postMessage(
                {
                    type: 'transformed_one',
                    index: m.data.index,
                    buffer: m.data.buffer,
                },
                [m.data.buffer],
            )
            break
    }
}
