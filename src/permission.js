import router from './router'
import store from './store'
import NProgress from 'nprogress' // 进度条
import 'nprogress/nprogress.css' // 进度条样式
import { getToken } from '@/utils/auth' // 从cookie获取token
import { resetRouter, addRoutes } from './router'
NProgress.configure({ showSpinner: false }) // 进度条配置

// 白名单：不需要登录就可以访问的页面
// const whiteList = ['/login', '/register', '/forgot-password']

/**
 * 路由前置守卫
 * 每次路由跳转前都会执行
 */
router.beforeEach(async(to, from, next) => {
  NProgress.start()
  console.log('当前路由实例的路由表:', router.options.routes)
  console.log('当前路径:', to.path)
  const hasToken = getToken()
  console.log('to', to)

  if (hasToken) {
    if (to.path === '/login') {
      next('/')
      NProgress.done()
    } else {
      // 每次都需要获取用户信息和菜单
      // 这样切换用户时自动刷新，虽然有点性能损失但可靠
      try {
        console.log('🔄 检查用户状态...')

        // 1. 获取用户信息
        await store.dispatch('user/getInfo')

        // 2. 获取当前用户ID
        const userInfo = store.getters['user/userInfo']
        const currentUserId = userInfo?.id

        // 3. 检查是否需要更新路由
        const lastUserId = store.getters['permission/lastUserId']

        if (!currentUserId || currentUserId !== lastUserId) {
          console.log(`用户变化或首次登录: ${lastUserId} -> ${currentUserId}`)

          // 获取动态菜单
          const accessRoutes = await store.dispatch('permission/getRoutes')

          // 重置路由
          resetRouter()

          // 添加新路由
          addRoutes(accessRoutes)

          // 保存当前用户ID
          store.commit('permission/SET_LAST_USER_ID', currentUserId)
        }

        next()
      } catch (error) {
        console.error('检查用户状态失败:', error)
        await store.dispatch('user/resetToken')
        next('/login')
        NProgress.done()
      }
    }
  } else {
    if (to.path === '/login') {
      next()
    } else {
      next(`/login?redirect=${to.path}`)
      NProgress.done()
    }
  }
})

/**
 * 路由后置守卫
 * 路由跳转完成后执行
 */
router.afterEach(() => {
  // 完成进度条
  NProgress.done()
})
