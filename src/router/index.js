import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

// 只有登录页和404是固定的
export const constantRoutes = [
  {
    path: '/login',
    component: () => import('@/views/login/index'),
    hidden: true
  },
  {
    path: '/404',
    component: () => import('@/views/error-page/404'),
    hidden: true
  },
  {
    path: '/',
    component: () => import('@/layout'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        component: () => import('@/views/dashboard/index'),
        name: 'Dashboard',
        meta: { title: '首页', icon: 'dashboard' }
      }
    ]
  },
  // 404页面必须放在最后
  {
    path: '*',
    redirect: '/404',
    hidden: true
  }
]

const createRouter = () =>
  new VueRouter({
    mode: 'history',
    routes: []
  })

const router = createRouter()
export function resetRouter() {
  const newRouter = createRouter()
  // 重置路由器的匹配器
  router.matcher = newRouter.matcher
}
// 动态添加路由的方法
export function addRoutes(routes) {
  // 添加用户路由
  router.addRoutes(constantRoutes)
  if (routes && routes.length > 0) {
    router.addRoutes(routes)
  }

  // 确保404在最后
  // router.addRoutes({
  //   path: '*',
  //   redirect: '/404',
  //   hidden: true
  // })
}
// 初始添加静态路由
addRoutes([])
export default router
