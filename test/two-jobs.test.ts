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
  })
})
