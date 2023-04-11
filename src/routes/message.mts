import RouterEngine from '@koa/router'

import MessageController from '../controller/message.mjs'

const router = new RouterEngine()

router.prefix('/q')

router.all('/sendMsg/sse', MessageController.sendMsgSSE)

export default router
