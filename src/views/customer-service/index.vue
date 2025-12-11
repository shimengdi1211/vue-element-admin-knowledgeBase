<template>
  <div class="app-container">
    <el-card class="box-card">
      <div slot="header">
        <span>智能客服</span>
      </div>

      <div class="chat-container">
        <div ref="messagesContainer" class="chat-messages">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message', msg.role]"
          >
            <div class="message-bubble">
              {{ msg.content }}
              <span
                v-if="msg.role === 'assistant' && msg.isStreaming"
                class="typing-cursor"
              >▊</span>
            </div>
          </div>
          <!-- 正在输入指示器 -->
          <div v-if="isLoading" class="message assistant typing">
            <div class="message-content">
              <span class="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div>
        </div>

        <div class="chat-input">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="2"
            placeholder="请输入您的问题..."
            :disabled="isLoading"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <el-button
            type="primary"
            :loading="isLoading"
            :disabled="!inputMessage.trim() || isLoading"
            @click="sendMessage"
          >
            发送
          </el-button>
          <el-button
            v-if="isStreaming"
            type="danger"
            @click="stopStream"
          >
            停止生成
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { chatWithAIStream } from '@/api/chat'
export default {
  name: 'CustomerService',
  data() {
    return {
      messages: [
        {
          role: 'assistant',
          content: '您好！我是智能客服，有什么可以帮您的吗？'
        }
      ],
      isLoading: false,
      isStreaming: false,
      currentStreamController: null, // 用于中止流式请求
      inputMessage: '',
      // userInput: '',
      // loading: false,
      sessionId: this.generateSessionId()
    }
  },
  mounted() {
    // this.scrollToBottom()
    this.loadHistory()
    this.sessionId = this.generateSessionId()
  },
  methods: {
    generateSessionId() {
      // 生成唯一的会话ID
      return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    },
    async sendMessage() {
      const message = this.inputMessage.trim()
      console.log(message)
      if (!message || this.isLoading) return

      // 添加用户消息
      this.addMessage('user', message)
      this.inputMessage = ''
      this.isLoading = true
      this.isStreaming = true

      try {
        // 创建中止控制器
        const controller = new AbortController()
        this.currentStreamController = controller

        // 调用流式API
        await this.callStreamAPI(message, controller.signal)
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('用户中止了生成')
          // 添加中止提示
          this.addMessage('assistant', this.messages[this.messages.length - 1].content + '（用户中止生成）')
        } else {
          console.error('发送消息失败:', error)
          this.addMessage('assistant', '抱歉，处理您的消息时出现了错误，请稍后重试。')
        }
      } finally {
        this.isLoading = false
        this.isStreaming = false
        this.currentStreamController = null
      }
    },

    async callStreamAPI(message, signal) {
      // 创建新的assistant消息（初始为空）
      const assistantMessageIndex = this.addMessage('assistant', '', true)

      let fullResponse = ''

      try {
        const response = await chatWithAIStream({
          message: message,
          sessionId: this.sessionId
        }, {
          signal, // 传递AbortSignal
          onMessage: (chunk) => {
            // 处理每个数据块
            if (chunk.data === '[DONE]') {
              console.log('流式响应完成')
              this.isStreaming = false
              return
            }

            try {
              const data = JSON.parse(chunk.data)

              if (data.error) {
                throw new Error(data.error)
              }

              // 提取文本内容
              const text = data.choices?.[0]?.delta?.content || ''

              if (text) {
                fullResponse += text

                // 更新消息内容
                this.$set(this.messages[assistantMessageIndex], 'content', fullResponse)
                this.$set(this.messages[assistantMessageIndex], 'isStreaming', true)

                // 滚动到底部
                this.scrollToBottom()
              }

              // 检查是否完成
              if (data.choices?.[0]?.finish_reason) {
                console.log('生成完成，原因:', data.choices[0].finish_reason)
                this.$set(this.messages[assistantMessageIndex], 'isStreaming', false)
                this.isStreaming = false
              }
            } catch (parseError) {
              console.error('解析流数据失败:', parseError)
            }
          },
          onError: (error) => {
            console.error('流式请求错误:', error)
            this.isStreaming = false
          },
          onComplete: () => {
            console.log('流式请求完成')
            this.isStreaming = false

            // 保存到历史
            this.saveHistory()
          }
        })
        console.log(response)
      } catch (error) {
        if (error.name !== 'AbortError') {
          throw error
        }
      }
    },

    stopStream() {
      if (this.currentStreamController) {
        this.currentStreamController.abort()
        this.isStreaming = false
        this.isLoading = false

        // 更新最后一条消息状态
        const lastMsg = this.messages[this.messages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false
        }
      }
    },

    addMessage(role, content, isStreaming = false) {
      const message = {
        role,
        content,
        timestamp: new Date().toISOString(),
        isStreaming
      }

      this.messages.push(message)

      // 如果不是流式消息，立即保存
      if (!isStreaming) {
        this.saveHistory()
      }

      // 滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom()
      })

      return this.messages.length - 1 // 返回消息索引
    },

    scrollToBottom() {
      const container = this.$refs.messagesContainer
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    },

    loadHistory() {
      const history = localStorage.getItem('ai_chat_history')
      if (history) {
        try {
          this.messages = JSON.parse(history)
        } catch (e) {
          console.error('加载历史记录失败:', e)
        }
      }
    },

    saveHistory() {
      // 只保存非流式状态的完整消息
      const history = this.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
      localStorage.setItem('ai_chat_history', JSON.stringify(history))
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-container {
  height: 500px;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8f9fa;

  .message {
    margin-bottom: 16px;

    &.user {
      text-align: right;

      .message-bubble {
        background: #409EFF;
        color: white;
        border-radius: 18px 18px 4px 18px;
      }
    }

    &.assistant {
      text-align: left;

      .message-bubble {
        background: white;
        color: #333;
        border: 1px solid #e0e0e0;
        border-radius: 18px 18px 18px 4px;
      }
    }

    .message-bubble {
      display: inline-block;
      max-width: 70%;
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.4;
    }
  }
}

.chat-input {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  background: white;
}
</style>
