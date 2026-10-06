export function postAuthPath() {
    const path = new URLSearchParams(window.location.search).get('redirectTo')
    return path && /^\/native\/connect\?flow=[a-f0-9]{64}$/.test(path) ? path : '/profile'
}
export function authPagePath(page: 'login' | 'register') {
    const redirectTo = postAuthPath()
    return redirectTo === '/profile' ? `/${page}` : `/${page}?${new URLSearchParams({ redirectTo })}`
}
