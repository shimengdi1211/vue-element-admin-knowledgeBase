import { constantRoutes } from '@/router'
import { getMenus } from '@/api/user'
import { addRoutes, resetRouter } from '@/router'

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
          console.log('后端返回的菜单数据:', data)

          // 格式化路由
          const routes = formatRoutes(data)
          console.log('格式化后的路由:', routes)

          // 格式化侧边栏菜单
          const sidebarMenus = formatSidebarMenus(data)

          resetRouter() // 先重置路由
          const allRoutes = [...constantRoutes]
          // 重置并添加路由
          addRoutes() //  再添加新路由
          // 保存到vuex
          commit('SET_ROUTES', [])
          commit('SET_SIDEBAR_MENUS', sidebarMenus)
          commit('SET_LAST_USER_ID', currentUserId) //  保存用户ID

          console.log('✅ 路由配置完成')
          console.log('- 常量路由数量:', constantRoutes.length)
          console.log('- 动态路由数量:', [])
          console.log('- 总路由数量:', allRoutes.length)
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
    console.log('格式化菜单:', menu.meta.title, '组件:', menu.component)

    const route = {
      path: menu.path || '',
      name: menu.name || '',
      meta: {
        title: menu.meta.title || '未命名',
        icon: menu.meta.icon || '',
        hidden: menu.meta.hidden === 1 || menu.meta.hidden === true
      }
    }

    if (menu.component) {
      route.component = getComponent(menu.component)
    } else if (menu.children && menu.children.length > 0) {
      // 如果没有组件但有子菜单，使用 Layout
      route.component = () => import('@/layout')
    } else {
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

  console.log('格式化后的路由:', routes)
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
  console.log('获取组件:', componentPath)

  if (!componentPath) return null

  if (componentPath === 'Layout' || componentPath === 'layout') {
    return () => import('@/layout')
  }

  // 根据路径动态导入
  try {
    if (componentPath.includes('/')) {
      return () => import(`@/views/${componentPath}`)
    } else {
      return () => import(`@/views/${componentPath}/index`)
    }
  } catch (error) {
    console.error('动态导入组件失败:', componentPath, error)
    // 返回一个错误组件
    return {
      render(h) {
        return h('div', `组件加载失败: ${componentPath}`)
      }
    }
  }
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
