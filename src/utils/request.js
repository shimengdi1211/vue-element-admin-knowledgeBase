import axios from 'axios'
import { MessageBox, Message } from 'element-ui'
import store from '@/store'
import { getToken } from '@/utils/auth'

// create an axios instance
const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API, // url = base url + request url
  // withCredentials: true, // send cookies when cross-domain requests
  timeout: 30000 // request timeout
})

// request interceptor
service.interceptors.request.use(
  config => {
    // do something before request is sent
    console.log('请求拦截器')
    if (config.method === 'post' || config.method === 'put') {
      // 如果 data 是对象，且没有明确设置 Content-Type
      if (config.data && typeof config.data === 'object' && !config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json'
      }
    }

    const token = getToken()
    // 如果 token 存在，添加到 headers
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    console.log(config)
    return config
  },
  error => {
    // do something with request error
    console.log(error) // for debug
    return Promise.reject(error)
  }
)

// response interceptor
service.interceptors.response.use(
  /**
   * If you want to get http information such as headers or status
   * Please return  response => response
   */

  /**
   * Determine the request status by custom code
   * Here is just an example
   * You can also judge the status by HTTP Status Code
   */
  response => {
    const res = response.data
    console.log('响应拦截器')
    console.log(res)
    // If the backend does not use the original `code: 20000` convention,
    // accept responses that either have `code === 20000` OR `success === true`.
    // Treat as error only when neither convention is present.
    if (res.code !== 200 && res.success !== true && res.code !== 20000) {
      Message({
        message: res.message || 'Error',
        type: 'error',
        duration: 5 * 1000
      })

      // 50008: Illegal token; 50012: Other clients logged in; 50014: Token expired;
      if (res.code === 50008 || res.code === 50012 || res.code === 50014) {
        // to re-login
        MessageBox.confirm(
          'You have been logged out, you can cancel to stay on this page, or log in again',
          'Confirm logout',
          {
            confirmButtonText: 'Re-Login',
            cancelButtonText: 'Cancel',
            type: 'warning'
          }
        ).then(() => {
          store.dispatch('user/resetToken').then(() => {
            location.reload()
          })
        })
      }
      return Promise.reject(new Error(res.message || 'Error'))
    } else {
      console.log('响应成功')
      return res
    }
  },
  error => {
    console.log('err' + error) // for debug
    Message({
      message: error.message,
      type: 'error',
      duration: 30 * 1000
    })
    return Promise.reject(error)
  }
)

export const get = (url, params = {}) => {
  return service({
    method: 'get',
    params,
    url
  })
}
export const post = (url, data = {}, params = {}, config = {}) => {
  return service({
    ...config,
    method: 'post',
    data,
    params,
    url
  })
}
export default service
