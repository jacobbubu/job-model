import { JobModel, link } from '../src'
import { delay } from './utils'

describe('lock', () => {
  const jobKey = 'download-1'
  const jobName = 'download video'
  const meta = { url: 'https://olddriver.com/your_fav_av.mp4' }
  const jobStatus = '30%'
  const jobAnotherStatus = 'Another Status'

  function prepare() {
    const a = new JobModel({ id: 'A' })
    const b = new JobModel({ id: 'B' })
    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)
    return { a, b }
  }

  it('progress lock', async () => {
    const { a, b } = prepare()

    const aFired = jest.fn()
    const bFired = jest.fn()

    a.on('progress', aFired)
    b.on('progress', bFired)

    a.create(jobKey, jobName, meta)
    await delay(50)

    a.progress(jobKey, jobStatus)
    // b's report will be ignored
    b.progress(jobKey, jobAnotherStatus)
    await delay(50)

    expect(aFired).toBeCalledTimes(1)
    expect(bFired).toBeCalledTimes(1)
  })

  it('not locked by lock owner', async () => {
    const { a, b } = prepare()

    const aFired = jest.fn()
    const bFired = jest.fn()

    a.on('progress', aFired)
    b.on('progress', bFired)

    a.create(jobKey, jobName, meta)
    await delay(50)

    a.progress(jobKey, jobStatus)
    a.progress(jobKey, jobAnotherStatus)
    await delay(50)

    expect(aFired).toBeCalledTimes(2)
    expect(bFired).toBeCalledTimes(2)
  })
})
