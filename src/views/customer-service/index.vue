<template>
  <div class="app-container">
    <el-card class="box-card">
      <div slot="header">
        <span>智能客服</span>
      </div>

      <div class="chat-container">
        <div ref="messagesContainer" class="chat-messages">
          <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
            <div class="message-bubble">
              {{ msg.content }}
              <span
v-if="msg.role === 'assistant' && msg.isStreaming"
class="typing-cursor"
                >▊</span
              >
            </div>
            <div v-if="msg.showRegenerate" class="message-actions">
              <el-button
                size="mini"
                type="primary"
                plain
                icon="el-icon-refresh"
                @click="regenerateThisMessage(msg)"
              >
                重新生成
              </el-button>

              <el-button size="mini" type="text" @click="removeRegenerateButton(msg)">
                不再提示
              </el-button>
            </div>
          </div>
          <!-- 正在输入指示器 -->
          <!-- <div v-if="isLoading" class="message assistant typing">
            <div class="message-content">
              <span class="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div> -->
          <!-- 重新生成按钮（只在被中断的消息下方显示） -->
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
          <el-button v-if="isStreaming" type="danger" @click="stopStream"> 停止生成 </el-button>
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
          content: '您好！我是智能客服，有什么可以帮您的吗？',
          timestamp: '...',
          interrupted: false, // 是否被中断
          showRegenerate: false // 是否显示重新生成按钮
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
        await this.callStreamAPI(message, controller.signal, false)
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('用户中止了生成')
          // 添加中止提示
          this.addMessage(
            'assistant',
            this.messages[this.messages.length - 1].content + '（用户中止生成）'
          )
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

    async callStreamAPI(message, signal, isRegeneration = false) {
      // 创建新的assistant消息（初始为空）
      // const assistantMessageIndex = this.addMessage('assistant', '', true)
      let assistantMessageIndex
      if (isRegeneration) {
        // 找到最后一条AI消息
        for (let i = this.messages.length - 1; i >= 0; i--) {
          if (this.messages[i].role === 'assistant') {
            assistantMessageIndex = i
            // 清空内容准备重新生成
            this.$set(this.messages[i], 'content', '')
            this.$set(this.messages[i], 'isStreaming', true)
            this.$set(this.messages[i], 'interrupted', false)
            this.$set(this.messages[i], 'showRegenerate', false)
            break
          }
        }
      } else {
        // 正常流程：创建新的AI消息
        assistantMessageIndex = this.addMessage('assistant', '', true)
      }
      let fullResponse = ''
      console.log(isRegeneration)
      try {
        const response = await chatWithAIStream(
          {
            message: message,
            sessionId: this.sessionId,
            isRegeneration: isRegeneration
          },
          {
            signal, // 传递AbortSignal
            onMessage: chunk => {
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
                  console.log('isLoading' + this.isLoading)
                }
              } catch (parseError) {
                console.error('解析流数据失败:', parseError)
              }
            },
            onError: error => {
              console.error('流式请求错误:', error)
              this.isStreaming = false
            },
            onComplete: () => {
              console.log('流式请求完成')
              this.isStreaming = false

              // 保存到历史
              this.saveHistory()
            }
          }
        )
        console.log('流式API调用完成' + response)
        this.isLoading = false
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
          lastMsg.interrupted = true
          lastMsg.showRegenerate = true // 关键：显示重新生成按钮
        }
        if (!lastMsg.content.includes('（已中断）')) {
          lastMsg.content += '（已中断）'
        }
      }
    },
    // 重新生成指定消息
    async regenerateThisMessage(interruptedMsg) {
      // 1. 隐藏按钮
      interruptedMsg.showRegenerate = false

      console.log(interruptedMsg)
      // 2. 找到对应的用户问题
      // const msgIndex = this.messages.findIndex(msg => msg.id === interruptedMsg.id);
      let userQuestion = ''
      console.log(this.messages)
      // console.log(msgIndex)
      // 向前搜索最近的一条用户消息
      // for (let i = msgIndex - 1; i >= 0; i--) {
      //   if (this.messages[i].role === 'user') {
      //     userQuestion = this.messages[i].content;
      //     break;
      //   }
      // }
      userQuestion = this.messages[this.messages.length - 2].content
      console.log(userQuestion)
      if (!userQuestion) {
        this.$message.error('未找到对应的问题')
        return
      }

      // 3. 清空中断的消息内容
      interruptedMsg.content = ''
      interruptedMsg.isStreaming = true
      interruptedMsg.interrupted = false

      // 4. 重新调用API
      this.isStreaming = true
      this.isLoading = true
      console.log(this.isLoading)

      try {
        // 重新创建流式请求
        const controller = new AbortController()
        await this.callStreamAPI(userQuestion, controller.signal, true) // true表示是重新生成

        // 重新生成成功后，完全移除按钮
        interruptedMsg.showRegenerate = false
      } catch (error) {
        if (error.name !== 'AbortError') {
          // 恢复按钮显示
          interruptedMsg.showRegenerate = true
          this.$message.error('重新生成失败')
        }
      }
    },

    // 不再提示
    removeRegenerateButton(msg) {
      msg.showRegenerate = false
      this.$message.info('已隐藏重新生成按钮')
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
          background: #409eff;
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
  /* 消息包装器 */
  .message-wrapper {
    margin-bottom: 16px;
  }

  /* 消息操作区域 */
  .message-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding-left: 50px; /* 与消息对齐 */

    /* 只对AI消息的操作区域有效 */
    .message.assistant + & {
      padding-left: 50px;
    }

    .message.user + & {
      padding-left: 0;
      justify-content: flex-end;
    }
  }

  /* 消息气泡 */
  .message-bubble {
    position: relative;
    padding: 12px 16px;
    border-radius: 18px;
    max-width: 80%;
    word-wrap: break-word;

    /* AI消息样式 */
    .message.assistant & {
      background: #f0f7ff;
      border: 1px solid #d0e3ff;
      margin-left: 0;
    }

    /* 用户消息样式 */
    .message.user & {
      background: #409eff;
      color: white;
      margin-left: auto;
    }
  }

  /* 中断消息的特殊样式 */
  .message.interrupted .message-bubble {
    border-color: #ffa500;
    background: #fffaf0;
  }

  /* 打字光标 */
  .typing-cursor {
    animation: blink 1s infinite;
    color: #666;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }
  .chat-input {
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    background: white;
  }
</style>
