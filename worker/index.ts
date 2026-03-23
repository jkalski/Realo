import 'dotenv/config'
import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { handleNewLeadFollowup, checkHotLead } from './workflows'
import type { JobData } from './queue'

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {}
}) as any

console.log('Realo worker starting...')

const workflowWorker = new Worker<JobData>(
  'workflows',
  async (job) => {
    console.log(`Processing job: ${job.name}`, job.data)

    const { type, account_id, contact_id, workflow_instance_id, step } = job.data

    switch (type) {
      case 'new_lead_followup':
        if (!contact_id || !workflow_instance_id || step === undefined) {
          throw new Error('Missing required fields for new_lead_followup')
        }
        await handleNewLeadFollowup(
          account_id,
          contact_id,
          workflow_instance_id,
          step
        )
        break

      default:
        console.log(`Unknown job type: ${type}`)
    }
  },
  {
    connection,
    concurrency: 5,
  }
)

const alertWorker = new Worker<JobData>(
  'alerts',
  async (job) => {
    console.log(`Processing alert: ${job.name}`, job.data)

    const { type, account_id, contact_id } = job.data

    switch (type) {
      case 'hot_lead_alert':
        if (!contact_id) break
        console.log(`HOT LEAD ALERT: contact ${contact_id} in account ${account_id}`)
        break

      default:
        console.log(`Unknown alert type: ${type}`)
    }
  },
  { connection }
)

workflowWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`)
})

workflowWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
})

alertWorker.on('completed', (job) => {
  console.log(`Alert ${job.id} completed`)
})

alertWorker.on('failed', (job, err) => {
  console.error(`Alert ${job?.id} failed:`, err.message)
})

process.on('SIGTERM', async () => {
  await workflowWorker.close()
  await alertWorker.close()
})