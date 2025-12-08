import { post } from '@/utils/request'

export function sendChatMessage(params) {
  return post(
    '/api/chat',
    params
  )
}
