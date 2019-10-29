import { JobModel, link } from '../src'
import { delay } from './utils'

describe('two jobs', () => {
  const jobKey = 'download-1'
  const jobName = 'download video'
  const meta = { url: 'https://olddriver.com/your_fav_av.mp4' }
  const jobStatus = '30%'
  const jobError = null
  const jobResult = 'FIN'

  const jobAnotherKey = 'download-2'
  const jobAnotherName = 'download music'
  const anotherMeta = { url: 'https://olddriver.com/your_fav_av.mp3' }
  const jobAnotherStatus = 'Another Status'
  const jobAnotherError = 'ERR'
  const jobAnotherResult = undefined

  function prepare() {
    const a = new JobModel({ id: 'A' })
    const b = new JobModel({ id: 'B' })
    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)
    return { a, b }
  }

  it('create two jobs', async () => {
    const { a, b } = prepare()

    a.create(jobKey, jobName, meta)
    b.create(jobAnotherKey, jobAnotherName, anotherMeta)
    await delay(50)

    expect(a.getJobName(jobKey)).toBe(jobName)
    expect(a.getJobName(jobAnotherKey)).toBe(jobAnotherName)
    expect(b.getJobName(jobKey)).toBe(jobName)
    expect(b.getJobName(jobAnotherKey)).toBe(jobAnotherName)

    expect(a.stats()).toEqual({ count: 2, failed: 0, succeeded: 0 })
    expect(b.stats()).toEqual({ count: 2, failed: 0, succeeded: 0 })
  })

  it('create two jobs with events', done => {
    const { a, b } = prepare()

    let counter = 4
    b.on('created', () => {
      if (!--counter) done()
    })

    a.on('created', () => {
      if (!--counter) done()
    })

    a.create(jobKey, jobName, meta)
    a.create(jobAnotherKey, jobAnotherName, anotherMeta)
  })

  it('toJSON', async () => {
    const { a, b } = prepare()

    const expected = {
      [jobKey]: {
        create: { name: jobName, meta },
        progress: [jobStatus],
        done: { error: jobError, result: jobResult }
      },
      [jobAnotherKey]: {
        create: { name: jobAnotherName, meta: anotherMeta },
        progress: [jobAnotherStatus],
        done: { error: jobAnotherError, result: jobAnotherResult }
      }
    }

    a.create(jobKey, jobName, meta)
    b.create(jobAnotherKey, jobAnotherName, anotherMeta)
    await delay(50)
    a.progress(jobKey, jobStatus)
    a.done(jobKey, null, jobResult)
    a.progress(jobAnotherKey, jobAnotherStatus)
    a.done(jobAnotherKey, jobAnotherError)
    await delay(50)

    expect(a.toJSON()).toStrictEqual(expected)
    expect(a.stats()).toEqual({ count: 2, failed: 1, succeeded: 1 })
    expect(b.stats()).toEqual({ count: 2, failed: 1, succeeded: 1 })
  })
})
