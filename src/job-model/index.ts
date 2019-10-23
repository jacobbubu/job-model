import Scuttlebutt, {
  Update,
  ScuttlebuttOptions,
  ModelAccept,
  Sources,
  filter,
  sort,
  UpdateItems,
  link
} from '@jacobbubu/scuttlebutt-pull'

enum JobTrxItems {
  Key = 0,
  Method,
  Arg1,
  Arg2
}

interface JobData {
  create?: Update
  progress?: Update[]
  done?: Update
  [index: string]: Update | Update[] | undefined
}

type JobKey = string

interface LockedBy {
  sourceId: string
  ts: number
}

class JobModel extends Scuttlebutt {
  public store: Record<JobKey, JobData> = {}
  private _lockedBy: Record<JobKey, LockedBy> = {}

  constructor(opts?: ScuttlebuttOptions | string) {
    super(opts)
  }

  lock(update: Update) {
    const ts = update[UpdateItems.Timestamp]
    const sourceId = update[UpdateItems.SourceId]
    const key = update[UpdateItems.Data][JobTrxItems.Key]

    if (!this._lockedBy[key]) {
      this._lockedBy[key] = {
        sourceId,
        ts
      }
      return true
    } else if (this._lockedBy[key].sourceId === sourceId) {
      this._lockedBy[key].ts = ts
      return true
    } else {
      return false
    }
  }

  create(key: string, name: string, meta?: any) {
    if (this.store[key]) {
      throw new Error(`Job exists(${key})`)
    }
    return this.localUpdate([key, 'create', name, meta])
  }

  progress(key: string, status: number | string | Object) {
    if (!this.store[key]) {
      throw new Error(`Job not found(${key})`)
    }

    if (this.store[key].done) {
      throw new Error(`Can not report a progress on a finished job(${key})`)
    }
    return this.localUpdate([key, 'progress', status])
  }

  done(key: string, err?: null | Error | string, result?: any) {
    if (!this.store[key]) {
      throw new Error(`Job not found(${key})`)
    }

    if (this.store[key].done) {
      throw new Error(`Can not done a job that has finished already(${key})`)
    }
    return this.localUpdate([key, 'done', err, result])
  }

  getJobName(key: string) {
    if (!this.store[key]) {
      throw new Error(`Job not found(${key})`)
    }
    return this.store[key]['create']![UpdateItems.Data][JobTrxItems.Arg1]
  }

  getJobMeta(key: string) {
    if (!this.store[key]) {
      throw new Error(`Job not found(${key})`)
    }
    return this.store[key]['create']![UpdateItems.Data][JobTrxItems.Arg2]
  }

  getJobResult(key: string) {
    if (!(this.store[key] && this.store[key].done)) {
      return []
    }
    // result: [err, result]
    return this.store[key]['done']![UpdateItems.Data]
  }

  getJobProgress(key: string) {
    if (!this.store[key] || this.store[key].done) {
      return []
    }
    return this.store[key]['progress']![UpdateItems.Data]
  }

  _methodValue(key: string, method: string) {
    return this.store[key] && this.store[key][method]
  }

  _emitAll(eventName: string, key: string, fromPeer: boolean, ...args: any[]) {
    this.emit.apply(this, [eventName, key, ...args])
    this.emit.apply(this, [eventName + ':' + key, ...args])
    if (fromPeer) {
      eventName += 'ByPeer'
      this.emit.apply(this, [eventName, key, ...args])
      this.emit.apply(this, [eventName + ':' + key, ...args])
    }
  }

  _handleCreated(update: Update) {
    const trx = update[UpdateItems.Data]
    const key = trx[JobTrxItems.Key]
    if (this._methodValue(key, 'create') || this._methodValue(key, 'done')) {
      // job has already been created or it has done
      this.emit('_remove', update)
      return false
    }

    this.store[key] = {
      create: update
    }

    const name = trx[JobTrxItems.Arg1]
    const meta = trx[JobTrxItems.Arg2]
    this._emitAll('created', key, update[UpdateItems.SourceId] !== this.id, name, meta)
    return true
  }

  _handleDone(update: Update) {
    if (!this.lock(update)) {
      // ignored if the owner of lock is not the owner of update
      this.emit('_remove', update)
      return false
    }

    const trx = update[UpdateItems.Data]
    const key = trx[JobTrxItems.Key]
    if (!this._methodValue(key, 'create') || this._methodValue(key, 'done')) {
      // ignore uncreated or finished job
      this.emit('_remove', update)
      return false
    }

    this.store[key].done = update

    const error = trx[JobTrxItems.Arg1]
    const result = trx[JobTrxItems.Arg2]
    this._emitAll('done', key, update[UpdateItems.SourceId] !== this.id, error, result)
    return true
  }

  _handleProgress(update: Update) {
    if (!this.lock(update)) {
      // ignored if the owner of lock is not the owner of update
      this.emit('_remove', update)
      return false
    }

    const trx = update[UpdateItems.Data]
    const key = trx[JobTrxItems.Key]
    if (!this._methodValue(key, 'create') || this._methodValue(key, 'done')) {
      // ignore uncreated or finished job
      this.emit('_remove', update)
      return false
    }

    if (!this.store[key].progress) {
      this.store[key].progress = []
    }

    let pos = this.store[key].progress!.length
    const ts = update[UpdateItems.Timestamp]
    for (let i = 0; i < this.store[key].progress!.length; i++) {
      const u = this.store[key].progress![i]
      if (u[UpdateItems.Timestamp] > ts) {
        pos = i
        break
      }
    }
    this.store[key].progress!.splice(pos, 0, update)
    const status = trx[JobTrxItems.Arg1]
    this._emitAll('progress', key, update[UpdateItems.SourceId] !== this.id, status)
    return true
  }

  applyUpdate(update: Update) {
    const method = update[UpdateItems.Data][JobTrxItems.Method]
    switch (method) {
      case 'create':
        return this._handleCreated(update)
      case 'progress':
        return this._handleProgress(update)
      case 'done':
        return this._handleDone(update)
      default:
        throw new Error(`Invalid data: ${update}`)
    }
    return false
  }

  isAccepted(peerAccept: ModelAccept, update: Update) {
    return true
  }

  history(peerSources: Sources, peerAccept?: ModelAccept) {
    const h: Update[] = []
    Object.keys(this.store).forEach(jobKey => {
      Object.keys(this.store[jobKey]).forEach(method => {
        if (['create', 'done'].includes(method)) {
          const update = this.store[jobKey][method] as Update
          if (filter(update, peerSources)) {
            h.push(update)
          }
        } else {
          //  method === progress
          this.store[jobKey][method]!.forEach((update: Update) => {
            if (filter(update, peerSources)) {
              h.push(update)
            }
          })
        }
      })
    })

    return sort(h)
  }
}

export { JobModel, link }
