import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {}
}) as any

export const workflowQueue = new Queue('workflows', { connection })
export const alertQueue = new Queue('alerts', { connection })

export type JobData = {
  type: 'new_lead_followup' | 'reengage_stale' | 'birthday_check' | 'hot_lead_alert'
  account_id: string
  contact_id?: string
  workflow_instance_id?: string
  step?: number
}

export async function enqueueWorkflow(data: JobData, delayMs = 0) {
  return workflowQueue.add(data.type, data, {
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  })
}

export async function enqueueAlert(data: JobData) {
  return alertQueue.add(data.type, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })
}