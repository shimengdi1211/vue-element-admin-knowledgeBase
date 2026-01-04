import { constantRoutes } from '@/router'
import { getMenus } from '@/api/user'
import { addRoutes, resetRouter } from '@/router'
const componentCache = {}

// 初始化组件缓存
function initComponentCache() {
  try {
    const context = require.context('@/views', true, /\.vue$/)
    const keys = context.keys()

    console.log('📦 初始化组件缓存，找到文件:', keys.length)

    keys.forEach(key => {
      // 转换路径格式
      // ./customerService/index.vue -> customerService/index
      const cleanPath = key.replace(/^\.\//, '').replace(/\.vue$/, '')

      componentCache[cleanPath] = () => {
        return Promise.resolve(context(key))
      }

      // 如果是 index.vue，也注册目录名
      if (key.endsWith('/index.vue')) {
        const dirPath = key.replace(/\/index\.vue$/, '')
        componentCache[dirPath] = () => {
          return Promise.resolve(context(key)) // ⭐ 这个 context(key) 现在是在函数内部，调用时才执行
        }
      }
    })

    console.log('✅ 组件缓存初始化完成:', Object.keys(componentCache))
  } catch (error) {
    console.error('❌ 初始化组件缓存失败:', error)
  }
}

// 初始化
initComponentCache()
const state = {
  routes: [], // 用户可访问的所有路由
  addRoutes: [], // 动态添加的路由
  sidebarMenus: [], // 侧边栏菜单
  lastUserId: null // ⭐ 新增：记录上次的用户ID
}

const mutations = {
  SET_ROUTES: (state, routes) => {
    state.addRoutes = routes
    state.routes = [...constantRoutes, ...routes] // 使用展开运算符更清晰
  },
  SET_SIDEBAR_MENUS: (state, menus) => {
    state.sidebarMenus = menus
  },
  SET_LAST_USER_ID: (state, userId) => {
    //  新增
    state.lastUserId = userId
  },
  RESET_PERMISSION: state => {
    //  新增：重置权限状态
    state.routes = [...constantRoutes]
    state.addRoutes = []
    state.sidebarMenus = []
    state.lastUserId = null
  }
}

const actions = {
  // 从后端获取用户菜单
  getRoutes({ commit, rootState, getters }) {
    return new Promise((resolve, reject) => {
      // 获取当前用户ID
      const userInfo = rootState.user.userInfo
      const currentUserId = userInfo?.id
      const lastUserId = getters.lastUserId

      console.log('获取菜单 - 当前用户ID:', currentUserId, '上次用户ID:', lastUserId)

      // 如果用户没变且有路由，直接返回（可选优化）
      if (currentUserId && currentUserId === lastUserId && getters.addRoutes.length > 0) {
        console.log('同一用户，使用缓存的路由')
        resolve(getters.addRoutes)
        return
      }

      getMenus()
        .then(response => {
          const { data } = response
          // 格式化路由
          const routes = formatRoutes(data)
          console.log('格式化后的路由:', routes)

          // 格式化侧边栏菜单
          const sidebarMenus = formatSidebarMenus(data)

          resetRouter() // 先重置路由
          // const allRoutes = [...constantRoutes]
          // 重置并添加路由
          addRoutes(routes) //  再添加新路由
          // 保存到vuex
          commit('SET_ROUTES', routes)
          commit('SET_SIDEBAR_MENUS', sidebarMenus)
          commit('SET_LAST_USER_ID', currentUserId) //  保存用户ID
          resolve()
        })
        .catch(error => {
          console.error('获取菜单失败:', error)

          // 使用默认路由（确保包含常量路由）
          resetRouter()

          // 只添加默认的动态路由
          const defaultDynamicRoutes = getDefaultRoutes()
          addRoutes(defaultDynamicRoutes)

          commit('SET_ROUTES', defaultDynamicRoutes)
          commit('SET_SIDEBAR_MENUS', [])

          console.log('⚠️ 使用默认路由')
          resolve(defaultDynamicRoutes)
        })
    })
  },

  // ⭐ 新增：重置权限状态（退出登录时调用）
  resetPermission({ commit }) {
    return new Promise(resolve => {
      commit('RESET_PERMISSION')
      resetRouter()
      console.log('✅ 权限状态已重置')
      resolve()
    })
  }
}

// 格式化路由（后端返回的菜单转Vue路由）
function formatRoutes(menus) {
  const routes = []

  menus.forEach(menu => {
    const route = {
      path: menu.path || '',
      name: menu.name || '',
      meta: {
        title: menu.meta.title || '未命名',
        icon: menu.meta.icon || '',
        hidden: menu.meta.hidden === 1 || menu.meta.hidden === true,
        menuType: menu.meta.menuType || '1'
      }
    }

    if (menu.component) {
      route.component = getComponent(menu.component)
    } else if (menu.children && menu.children.length > 0) {
      // 如果没有组件但有子菜单，使用 Layout
      console.log('无组件，但有子菜单，使用Layout')
      route.component = () => import('@/layout')
    } else {
      console.log('警告：既无组件也无子菜单，使用404组件')
      // 既没有组件也没有子菜单，使用默认组件
      route.component = () => import('@/views/error-page/404')
    }

    if (menu.redirect) {
      route.redirect = menu.redirect
    }

    if (menu.always_show === 1 || menu.alwaysShow === true) {
      route.alwaysShow = true
    }

    if (menu.children && menu.children.length > 0) {
      route.children = formatRoutes(menu.children)
    }

    routes.push(route)
  })

  return routes
}
console.log('=== 完整的格式化路由结构 ===')
console.log(JSON.stringify(state.routes, null, 2))

// 格式化侧边栏菜单
function formatSidebarMenus(menus) {
  return menus.filter(menu => !(menu.hidden === 1 || menu.hidden === true))
}

// 获取组件（支持动态导入）
function getComponent(componentPath) {
  if (!componentPath) return null

  // 1. 从缓存中查找
  if (componentCache[componentPath]) {
    return componentCache[componentPath]
  }

  // 2. 处理 Layout
  if (componentPath === 'Layout' || componentPath === 'layout') {
    return () => import('@/layout')
  }

  // 可能的路径变体
  const possiblePaths = [
    componentPath,
    componentPath.toLowerCase(),
    componentPath.replace(/([A-Z])/g, '-$1').toLowerCase(), // camelCase to kebab
    componentPath.replace(/-([a-z])/g, g => g[1].toUpperCase()) // kebab to camelCase
  ].filter(path => componentCache[path])

  if (possiblePaths.length > 0) {
    return componentCache[possiblePaths[0]]
  }

  console.log(`❌ 未找到组件: ${componentPath}`)

  // 返回占位组件
  return () =>
    Promise.resolve({
      default: {
        name: 'NotFoundComponent',
        render(h) {
          return h(
            'div',
            {
              style: 'padding: 30px; text-align: center;'
            },
            [
              h('h2', '页面未找到'),
              h('p', `组件路径: ${componentPath}`),
              h(
                'button',
                {
                  on: {
                    click: () => {
                      console.log('尝试重新加载组件缓存...')
                      initComponentCache()
                    }
                  },
                  style: 'margin-top: 20px; padding: 10px 20px;'
                },
                '重新加载组件'
              )
            ]
          )
        }
      }
    })
}

function getDefaultRoutes() {
  return [
    {
      path: '/dashboard',
      component: () => import('@/views/dashboard/index'),
      name: 'Dashboard',
      meta: { title: '首页', icon: 'dashboard' }
    }
  ]
}

// ⭐ 新增：getters
const getters = {
  routes: state => state.routes,
  addRoutes: state => state.addRoutes,
  sidebarMenus: state => state.sidebarMenus,
  lastUserId: state => state.lastUserId //
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters //
}
