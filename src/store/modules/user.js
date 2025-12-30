// src/store/modules/user.js
import { login, logout, getInfo, updatePassword } from '@/api/user'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { resetRouter } from '@/router'
import store from '@/store'

const state = {
  token: getToken(), // 从cookie读取token
  userInfo: {}, // 用户详细信息
  roles: [], // 用户角色数组
  permissions: [], // 用户权限列表
  department: '', // 所属部门
  avatar: '', // 头像
  name: '' // 姓名
}

const mutations = {
  // 设置token
  SET_TOKEN: (state, token) => {
    state.token = token
  },

  // 设置用户信息
  SET_USER_INFO: (state, userInfo) => {
    state.userInfo = userInfo
    state.name = userInfo.name || ''
    state.avatar = userInfo.avatar || ''
    state.department = userInfo.department || ''
  },

  // 设置角色
  SET_ROLES: (state, roles) => {
    state.roles = roles
  },

  // 设置权限
  SET_PERMISSIONS: (state, permissions) => {
    state.permissions = permissions
  },

  // 清除用户信息
  CLEAR_USER_INFO: state => {
    state.userInfo = {}
    state.roles = []
    state.permissions = []
    state.department = ''
    state.avatar = ''
    state.name = ''
  }
}

const actions = {
  /**
   * 用户登录
   * @param {Object} userInfo - 登录信息 {username, password, rememberMe}
   */
  login({ commit }, userInfo) {
    const { username, password, rememberMe } = userInfo
    return new Promise((resolve, reject) => {
      login({
        username: username.trim(),
        password: password,
        rememberMe: rememberMe
      })
        .then(response => {
          const { data } = response
          // 1. 保存token到vuex
          commit('SET_TOKEN', data.token)
          // 2. 保存token到cookie/localStorage
          setToken(data.token, rememberMe)
          // 3. 登录后立即获取用户信息
          store
            .dispatch('user/getInfo')
            .then(() => {
              console.log('获取用户信息成功')
              resolve()
            })
            .catch(error => {
              console.log('获取用户信息失败')
              reject(error)
            })
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  /**
   * 获取用户信息
   * 登录后和刷新页面时调用
   */
  getInfo({ commit, state }) {
    return new Promise((resolve, reject) => {
      console.log('获取用户信息时的token:', state)
      getInfo(state.token)
        .then(response => {
          const { data } = response

          if (!data) {
            reject('验证失败，请重新登录。')
            return
          }

          // 验证角色数组
          const { roles, permissions, user } = data

          if (!roles || roles.length === 0) {
            reject('用户没有分配角色！')
            return
          }

          // 保存用户信息到vuex
          commit('SET_USER_INFO', user)
          commit('SET_ROLES', roles)
          commit('SET_PERMISSIONS', permissions)

          // 返回完整数据，供其他模块使用
          resolve(data)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  /**
   * 用户退出登录
   */
  logout({ commit, state }) {
    return new Promise((resolve, reject) => {
      logout(state.token)
        .then(() => {
          // 调用清理方法
          commit('CLEAR_USER_INFO')
          commit('SET_TOKEN', '')
          removeToken()

          // 重置路由（清除动态添加的路由）
          resetRouter()

          resolve()
        })
        .catch(error => {
          // 即使登出API失败，也要清理本地状态
          commit('CLEAR_USER_INFO')
          commit('SET_TOKEN', '')
          removeToken()
          resetRouter()

          reject(error)
        })
    })
  },

  /**
   * 修改密码
   * @param {Object} passwordInfo - {oldPassword, newPassword}
   */
  updatePassword({ state }, passwordInfo) {
    return new Promise((resolve, reject) => {
      updatePassword({
        ...passwordInfo,
        token: state.token
      })
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  /**
   * 前端登出（不调用后端API）
   * 用于token过期等情况
   */
  fedLogOut({ commit }) {
    return new Promise(resolve => {
      commit('CLEAR_USER_INFO')
      commit('SET_TOKEN', '')
      removeToken()
      resetRouter()
      resolve()
    })
  },

  /**
   * 重置token（token过期时使用）
   */
  resetToken({ commit }) {
    return new Promise(resolve => {
      commit('CLEAR_USER_INFO')
      commit('SET_TOKEN', '')
      removeToken()
      resolve()
    })
  },

  /**
   * 更新用户信息（如修改头像、姓名等）
   */
  updateUserInfo({ commit }, userInfo) {
    return new Promise(resolve => {
      commit('SET_USER_INFO', { ...state.userInfo, ...userInfo })
      resolve()
    })
  },

  /**
   * 验证用户是否拥有某个角色
   * @param {Array} roles - 需要验证的角色数组
   */
  hasRole({ state }, roles) {
    if (!state.roles || state.roles.length === 0) {
      return false
    }

    if (roles.includes('*')) {
      return true
    }

    return state.roles.some(role => roles.includes(role))
  },

  /**
   * 验证用户是否拥有某个权限
   * @param {String|Array} permissions - 需要验证的权限
   */
  hasPermission({ state }, permissions) {
    if (!state.permissions || state.permissions.length === 0) {
      return false
    }

    const permArray = Array.isArray(permissions) ? permissions : [permissions]

    if (permArray.includes('*')) {
      return true
    }

    return state.permissions.some(permission => permArray.includes(permission))
  }
}

const getters = {
  // 获取token
  token: state => state.token,

  // 获取用户信息
  userInfo: state => state.userInfo,

  // 获取用户姓名
  name: state => state.name,

  // 获取用户头像
  avatar: state => state.avatar,

  // 获取用户部门
  department: state => state.department,

  // 获取用户角色
  roles: state => state.roles,

  // 获取用户权限
  permissions: state => state.permissions,

  // 是否已登录
  isLogin: state => !!state.token,

  // 是否是管理员
  isAdmin: state => {
    return state.roles && state.roles.includes('admin')
  },

  // 是否是企业客户经理
  isCustomerManager: state => {
    return state.roles && state.roles.includes('customer_manager')
  },

  // 是否是产品经理
  isProductManager: state => {
    return state.roles && state.roles.includes('product_manager')
  }
}

export default {
  namespaced: true, // 开启命名空间
  state,
  mutations,
  actions,
  getters
}
