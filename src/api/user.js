import request from '@/utils/request'
import { post, get } from '@/utils/request'
// export function login(data) {
//   return request({
//     url: '/vue-element-admin/user/login',
//     method: 'post',
//     data
//   })
// }

// export function getInfo(token) {
//   return request({
//     url: '/vue-element-admin/user/info',
//     method: 'get',
//     params: { token }
//   })
// }

export function logout() {
  return request({
    url: '/vue-element-admin/user/logout',
    method: 'post'
  })
}

// // src/api/user.js
// import request from '@/utils/request'

// export function login(data) {
//   return request({
//     url: '/api/auth/login',
//     method: 'post',
//     data
//   })
// }

// 用户登录
export function login(params) {
  return post('/api/auth/login', params)
}
// 获取用户信息
export function getInfo(token) {
  // 通过 header 传递 token
  return get('/api/user/info', null, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}
// 添加获取菜单的 API
export function getMenus() {
  return request({
    url: '/api/user/menus',
    method: 'get'
  })
}
// // 用户退出
// export function logout(token) {
//   return request({
//     url: '/api/auth/logout',
//     method: 'post',
//     data: { token }
//   })
// }

// // 修改密码
// export function updatePassword(data) {
//   return request({
//     url: '/api/user/update-password',
//     method: 'put',
//     data
//   })
// }

// // 更新用户信息
// export function updateUserInfo(data) {
//   return request({
//     url: '/api/user/update-info',
//     method: 'put',
//     data
//   })
// }

// // 上传头像
// export function uploadAvatar(data) {
//   return request({
//     url: '/api/user/upload-avatar',
//     method: 'post',
//     headers: {
//       'Content-Type': 'multipart/form-data'
//     },
//     data
//   })
// }
