import 'jest-extended'
import { JobModel, link } from '../src'
import { delay } from './utils'

describe('basic', () => {
  const jobKey = 'download-1'
  const jobName = 'download video'
  const meta = { url: 'https://olddriver.com/your_fav_av.mp4' }
  const jobStatus = '30%'
  const jobResult = 'FIN'
  const jobError = 'FAIL'

  function prepare() {
    const a = new JobModel({ id: 'A' })
    const b = new JobModel({ id: 'B' })
    const s1 = a.createStream({ name: 'a->b' })
    const s2 = b.createStream({ name: 'b->a' })

    link(s1, s2)
    return { a, b }
  }

  it('create a job', done => {
    const { a, b } = prepare()
    a.create(jobKey, jobName, meta)

    expect(a.count()).toBe(1)
    expect(a.stats()).toEqual({ count: 1, failed: 0, succeeded: 0 })

    let count = 2

    b.on(`created`, (key, name, meta) => {
      expect(key).toBe(jobKey)
      expect(name).toBe(jobName)
      expect(meta).toBe(meta)
      count--
      expect(b.stats()).toEqual({ count: 1, failed: 0, succeeded: 0 })
      if (!count) done()
    })

    b.on(`createdByPeer:${jobKey}`, (name, meta) => {
      expect(name).toBe(jobName)
      expect(meta).toBe(meta)
      count--
      if (!count) done()
    })
  })

  it('notify a progress', done => {
    const { a, b } = prepare()
    a.create(jobKey, jobName, meta)
    a.progress(jobKey, jobStatus)

    let count = 4

    b.on(`progress`, (key, status) => {
      expect(key).toBe(jobKey)
      expect(status).toBe(jobStatus)
      count--
      if (!count) done()
    })

    b.on(`progressByPeer`, (key, status) => {
      expect(key).toBe(jobKey)
      expect(status).toBe(jobStatus)
      count--
      if (!count) done()
    })

    b.on(`progress:${jobKey}`, status => {
      expect(status).toBe(jobStatus)
      count--
      if (!count) done()
    })

    b.on(`progressByPeer:${jobKey}`, status => {
      expect(status).toBe(jobStatus)
      count--
      if (!count) done()
    })
  })

  it('finish a job', done => {
    const { a, b } = prepare()
    a.create(jobKey, jobName, meta)
    a.done(jobKey, null, jobResult)
    expect(a.stats()).toEqual({ count: 1, failed: 0, succeeded: 1 })

    let count = 4

    b.on(`done`, (key, err, result) => {
      expect(key).toBe(jobKey)
      expect(err).toBe(null)
      expect(result).toBe(jobResult)
      expect(b.stats()).toEqual({ count: 1, failed: 0, succeeded: 1 })
      count--
      if (!count) done()
    })

    b.on(`doneByPeer`, (key, err, result) => {
      expect(key).toBe(jobKey)
      expect(err).toBe(null)
      expect(result).toBe(jobResult)
      count--
      if (!count) done()
    })

    b.on(`done:${jobKey}`, (err, result) => {
      expect(err).toBe(null)
      expect(result).toBe(jobResult)
      count--
      if (!count) done()
    })

    b.on(`doneByPeer:${jobKey}`, (err, result) => {
      expect(err).toBe(null)
      expect(result).toBe(jobResult)
      count--
      if (!count) done()
    })
  })

  it('finish a job with error', done => {
    const { a, b } = prepare()
    a.create(jobKey, jobName, meta)
    a.done(jobKey, jobError)
    expect(a.stats()).toEqual({ count: 1, failed: 1, succeeded: 0 })

    b.on(`done`, (key, err, result) => {
      expect(key).toBe(jobKey)
      expect(err).toBe(jobError)
      expect(result).toBeNull()
      expect(b.stats()).toEqual({ count: 1, failed: 1, succeeded: 0 })
      done()
    })
  })

  it('prevent repeated creation', async () => {
    const { a, b } = prepare()
    a.create(jobKey, jobName, meta)
    expect(() => a.create(jobKey, jobName, meta)).toThrowWithMessage(Error, `Job exists(${jobKey})`)

    await delay(50)

    expect(() => b.create(jobKey, jobName, meta)).toThrowWithMessage(Error, `Job exists(${jobKey})`)
  })

  it('prevent progress on a non-existing job', async () => {
    const { a, b } = prepare()

    expect(() => a.progress(jobKey, jobStatus)).toThrowWithMessage(
      Error,
      `Job not found(${jobKey})`
    )

    await delay(50)

    expect(() => b.progress(jobKey, jobStatus)).toThrowWithMessage(
      Error,
      `Job not found(${jobKey})`
    )
  })

  it('prevent done on a non-existing job', async () => {
    const { a, b } = prepare()

    expect(() => a.done(jobKey, null, jobResult)).toThrowWithMessage(
      Error,
      `Job not found(${jobKey})`
    )

    await delay(50)

    expect(() => b.done(jobKey, null, jobResult)).toThrowWithMessage(
      Error,
      `Job not found(${jobKey})`
    )
  })

  it('prevent done on a finished job', async () => {
    const { a, b } = prepare()
    a.create(jobKey, jobName, meta)
    a.done(jobKey, null, jobResult)

    expect(() => a.done(jobKey, null, jobResult)).toThrowWithMessage(
      Error,
      `Can not done a job that has finished already(${jobKey})`
    )

    await delay(50)

    expect(() => b.done(jobKey, null, jobResult)).toThrowWithMessage(
      Error,
      `Can not done a job that has finished already(${jobKey})`
    )
  })
})
