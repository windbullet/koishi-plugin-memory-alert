import { Context, Schema } from 'koishi'
import { freemem, totalmem } from 'os'

export const name = 'memory-alert'

export const usage = `提醒内容中的 %m 会被替换为内存使用量`

export interface Config {
  userId: string
  content: string
  selfId: string
  limit: number
  warningInterval: number
  checkInterval: number
}

export const Config: Schema<Config> = Schema.object({
  userId: Schema.string()
    .description('接收提醒的用户ID')
    .required(),
  selfId: Schema.string()
    .description('发送提醒的机器人ID，格式为 平台名:ID，平台名以右下角状态栏显示的为准')
    .required(),
  limit: Schema.number()
    .description('内存使用量(%)超过多少时发送提醒')
    .min(1)
    .max(100)
    .required(),
  content: Schema.string()
    .description('提醒内容')
    .role("textarea")
    .default("警告：内存使用量已达到%m%"),
  warningInterval: Schema.number()
    .description("内存用量超出限制时，每隔多长时间(s)提醒一次，0表示不重复提醒")
    .default(0),
  checkInterval: Schema.number()
    .description('检测内存用量的间隔时间 (ms)')
    .default(1000),
})

export function apply(ctx: Context, config: Config) {
  let dispose
  let overLimit = false
  ctx.setInterval(async () => {
    const used = (totalmem() - freemem()) / totalmem() * 100
    if (used <= config.limit) {
      dispose?.()
      dispose = undefined
      overLimit = false
    } else if (!overLimit) {
      overLimit = true
      await sendWarning(used)
      if (config.warningInterval > 0) {
        const interval = config.warningInterval * 1000
        dispose = ctx.setInterval(async () => {
          const used = (totalmem() - freemem()) / totalmem() * 100
          await sendWarning(used)
        }, interval)
      }
    }
  }, config.checkInterval)
  

  async function sendWarning(used: number) {
    const bot = ctx.bots[config.selfId]
    const channel = await bot.createDirectChannel(config.userId)
    await bot.sendMessage(channel.id, config.content.replace('%m', `${used.toFixed(2)}`))
  }
}
