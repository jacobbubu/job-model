process.env.DEBUG = 'simple*'

import { Debug } from '@jacobbubu/debug'
import { JobModel, link } from '../src'

const logger = Debug.create('simple')

const a = new JobModel({ id: 'A' })
const b = new JobModel({ id: 'B' })

const aLogger = logger.ns(a.id)
const bLogger = logger.ns(b.id)

// in a <-> b relationship, a is read-only and b is write-only
const s1 = a.createStream({ name: 'a->b' })
const s2 = b.createStream({ name: 'b->a' })

link(s1, s2)

const jobKey = 'download-1'
a.create(jobKey, 'download video', { url: 'https://olddriver.com/your_fav_av.mp4' })

setTimeout(() => {
  a.progress(jobKey, 'the url of video is reachable')
}, 100)

setTimeout(() => {
  a.progress(jobKey, 'download is started')
}, 200)

setTimeout(() => {
  a.progress(jobKey, '30% downloaded')
}, 300)

setTimeout(() => {
  a.progress(jobKey, '70% downloaded')
}, 400)

setTimeout(() => {
  a.progress(jobKey, '100% downloaded')
}, 500)

setTimeout(() => {
  a.done(jobKey, null, 'all set, you can get the video at /trash/your_fav_av.mp4')
}, 600)

b.on(`createdByPeer:${jobKey}`, (name, meta) => {
  bLogger.info(`new job('%s') with metadata(%o) is created on %s`, name, meta, b.id)
})

b.on(`progressByPeer`, (key, status) => {
  bLogger.info(`job('%s') has a progress %o`, b.getJobName(key), status)
})

a.on(`progressByPeer`, (key, status) => {
  aLogger.info(`job('%s') has a progress %o`, b.getJobName(key), status)
})

b.on(`doneByPeer`, (key, err, result) => {
  if (err) {
    bLogger.error(`job('%s') failed. %o`, b.getJobName(key), err)
  } else {
    bLogger.info(`job('%s') has finished. %o`, b.getJobName(key), result)
  }
})
