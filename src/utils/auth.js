import Cookies from 'js-cookie'

const TokenKey = 'Admin-Token'
const RememberKey = 'Admin_remember'

// 设置token
export function setToken(token, rememberMe = false) {
  if (rememberMe) {
    // 记住我：保存7天
    Cookies.set(TokenKey, token, { expires: 7 })
    Cookies.set(RememberKey, 'true', { expires: 7 })
  } else {
    // 不记住我：session级别
    Cookies.set(TokenKey, token)
    Cookies.set(RememberKey, 'false')
  }
}

// 移除token
export function removeToken() {
  Cookies.remove(TokenKey)
  Cookies.remove(RememberKey)
}

// 是否记住我
export function isRememberMe() {
  return Cookies.get(RememberKey) === 'true'
}
export function getToken() {
  return Cookies.get(TokenKey)
}
