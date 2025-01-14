/*
 * @Author: chenweiyi
 * @Date: 2023-02-21 15:54:08
 * @Last Modified by: chenweiyi
 * @Last Modified time: 2023-02-21 15:54:08
 */
import {
  ChatGPTAPI,
  ChatGPTAPIOptions,
  ChatGPTUnofficialProxyAPI,
  ChatMessage
} from 'chatgpt'
import debugLibrary from 'debug'
import { EventEmitter } from 'events'
import proxy from 'https-proxy-agent'
import Koa from 'koa'
import { isNil } from 'lodash-es'
import fetch from 'node-fetch'
import { PassThrough } from 'stream'

interface GenerateChatGPTAPIProps extends ChatGPTAPIOptions {
  accessToken: string | undefined
  API_REVERSE_PROXY: string | undefined
}

const debug = debugLibrary('message')
const chatgptApiMap = new Map<string, ChatGPTAPI | ChatGPTUnofficialProxyAPI>()

const events = new EventEmitter()
events.setMaxListeners(0)

function GenerateChatGPTAPI(props: GenerateChatGPTAPIProps) {
  if (props.accessToken) {
    return new ChatGPTUnofficialProxyAPI({
      accessToken: props.accessToken,
      apiReverseProxyUrl: props.API_REVERSE_PROXY || undefined
    })
  } else {
    return new ChatGPTAPI({ ...props })
  }
}

export default class MessageController {
  /**
   * 获取chatgpt的消息的sse
   * @param ctx
   */
  public static async sendMsgSSE(ctx: Koa.Context) {
    const {
      msg,
      ownerId,
      parentMessageId,
      conversationId,
      model,
      apiKey,
      temperature,
      top_p
    } = ctx.request.query as any
    if (!chatgptApiMap.get(ownerId)) {
      const api = GenerateChatGPTAPI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
        accessToken: process.env.OPENAI_ACCESS_TOKEN,
        API_REVERSE_PROXY:
          process.env.API_REVERSE_PROXY ||
          'https://ai.fakeopen.com/api/conversation',
        completionParams: {
          model: model || 'gpt-3.5-turbo',
          temperature: isNil(temperature) ? 0.8 : +temperature,
          top_p: isNil(top_p) ? 1 : +top_p
        },
        // @ts-ignore
        fetch: process.env.PROXY_ADDRESS
          ? (url, options = {}) => {
              const defaultOptions = {
                agent: proxy(process.env.PROXY_ADDRESS)
              }
              const mergedOptions = {
                ...defaultOptions,
                ...options
              }
              // @ts-ignore
              return fetch(url, mergedOptions)
            }
          : undefined
      })
      chatgptApiMap.set(ownerId, api)
    }
    const api = chatgptApiMap.get(ownerId)
    const stream = new PassThrough()
    const listener = (str) => {
      stream.write(`data: ${str}\n\n`)
    }
    events.on('data', listener)
    stream.on('close', () => {
      debug('trigger on close')
      events.off('data', listener)
    })
    try {
      debug('execute sendMsgSSE ...')
      ctx.req.socket.setTimeout(0)
      ctx.req.socket.setNoDelay(true)
      ctx.req.socket.setKeepAlive(true)
      ctx.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      })

      ctx.status = 200
      ctx.body = stream

      api
        .sendMessage(msg, {
          onProgress: (partialResponse: ChatMessage) => {
            const data = JSON.stringify({
              text: partialResponse.text,
              id: partialResponse.id,
              conversationId: partialResponse.conversationId,
              done: false,
              error: false
            })
            // debug('onProgress data:', data)
            events.emit('data', data)
          },
          timeoutMs: +process.env.CHATGPT_REQUEST_TIMEOUT,
          ...(process.env.OPENAI_API_KEY && parentMessageId
            ? {
                parentMessageId
              }
            : {}),
          ...(!process.env.OPENAI_API_KEY &&
          process.env.OPENAI_ACCESS_TOKEN &&
          parentMessageId &&
          conversationId
            ? {
                parentMessageId,
                conversationId
              }
            : {})
        })
        .then((res) => {
          events.emit(
            'data',
            JSON.stringify({
              text: res.text,
              id: res.id,
              conversationId: res.conversationId,
              done: true,
              error: false
            })
          )
          stream.end()
        })
        .catch((e) => {
          debug('request error', e.message)
          events.emit(
            'data',
            JSON.stringify({
              text: e.message,
              id: 'error-' + new Date().getTime() + '',
              done: true,
              error: true
            })
          )
          stream.end()
        })
    } catch (e: any) {
      debug('catch error:', e)
      ctx.body = stream
      events.emit(
        'data',
        JSON.stringify({
          text: e.message ?? 'server inner error',
          id: 'error-' + new Date().getTime() + '',
          done: true,
          error: true
        })
      )
      stream.end()
    }
  }
}
