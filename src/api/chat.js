import { streamRequest } from '@/utils/streamRequest'
import { post } from '@/utils/request'

export function sendChatMessage(params) {
  return post(
    '/api/chat',
    params
  )
}

export function chatWithAIStream(data, options = {}) {
  const { signal, onMessage, onError, onComplete } = options

  return streamRequest({
    url: '/api/chat/stream',
    data,
    headers: {
      // 如果有token需要添加
      // 'Authorization': `Bearer ${getToken()}`
    },
    signal,
    onMessage,
    onError,
    onComplete
  })
}
