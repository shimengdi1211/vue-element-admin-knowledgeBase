/**
 * 流式请求封装
 * @param {Object} options 请求选项
 * @param {string} options.url 请求URL
 * @param {Object} options.data 请求数据
 * @param {Function} options.onMessage 收到消息时的回调
 * @param {Function} options.onError 错误回调
 * @param {Function} options.onComplete 完成回调
 * @param {AbortSignal} options.signal 中止信号
 * @returns {Promise} 请求Promise
 */
export async function streamRequest(options) {
  const {
    url,
    data,
    onMessage,
    onError,
    onComplete,
    signal,
    headers = {}
  } = options
  const baseURL = process.env.VUE_APP_BASE_API || ''
  // ✅ 拼接完整URL
  const fullUrl = baseURL + url

  console.log('流式请求URL:', fullUrl) // 调试用
  try {
    const response = await fetch(fullUrl, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data),
      signal // 支持中止
    })

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }
    if (!response.body) {
      throw new Error('响应没有body')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        if (onComplete) onComplete()
        break
      }

      // 解码数据
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk

      // 分割SSE格式的数据
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || '' // 最后一个可能是不完整的数据
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6) // 移除 'data: '
          try {
            if (onMessage) {
              onMessage({ data })
            }
          } catch (error) {
            console.error('处理消息失败:', error)
            if (onError) onError(error)
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求被中止')
      throw error
    }
    console.error('流式请求失败:', error)
    if (onError) onError(error)
    throw error
  }
}
