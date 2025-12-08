<template>
  <div class="app-container">
    <el-card class="box-card">
      <div slot="header">
        <span>智能客服</span>
      </div>

      <div class="chat-container">
        <div ref="messagesContainer" class="chat-messages">
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['message', message.role]"
          >
            <div class="message-bubble">
              {{ message.content }}
            </div>
          </div>
        </div>

        <div class="chat-input">
          <el-input
            v-model="userInput"
            placeholder="请输入您的问题..."
            @keyup.enter.native="sendMessage"
          >
            <el-button
              slot="append"
              icon="el-icon-position"
              :loading="loading"
              @click="sendMessage"
            >
              发送
            </el-button>
          </el-input>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { sendChatMessage } from '@/api/chat'
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
      userInput: '',
      loading: false,
      sessionId: this.generateSessionId()
    }
  },
  mounted() {
    this.scrollToBottom()
  },
  methods: {
    generateSessionId() {
      return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    },

    async sendMessage() {
      if (!this.userInput.trim() || this.loading) return

      const userMessage = this.userInput.trim()
      this.userInput = ''

      // 添加用户消息
      this.messages.push({
        role: 'user',
        content: userMessage
      })

      this.loading = true
      this.scrollToBottom()

      try {
        const response = await sendChatMessage({
          message: userMessage,
          sessionId: this.sessionId
        })
        if (response.success) {
          this.messages.push({
            role: 'assistant',
            content: response.reply
          })
        } else {
          throw new Error(response.error)
        }
      } catch (error) {
        this.$message.error('发送消息失败，请稍后重试')
        console.error('API调用失败:', error)
      } finally {
        this.loading = false
        this.scrollToBottom()
      }
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
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
