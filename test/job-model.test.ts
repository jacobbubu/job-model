import { JobModel, link } from '../src'

describe('basic', () => {
  const jobKey = 'download-1'
  const jobName = 'download video'
  const meta = { url: 'https://olddriver.com/your_fav_av.mp4' }
  const jobStatus = '30%'
  const jobResult = 'FIN'

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

    let count = 2

    b.on(`created`, (key, name, meta) => {
      expect(key).toBe(jobKey)
      expect(name).toBe(jobName)
      expect(meta).toBe(meta)
      count--
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

    let count = 4

    b.on(`done`, (key, err, result) => {
      expect(key).toBe(jobKey)
      expect(err).toBe(null)
      expect(result).toBe(jobResult)
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
})
