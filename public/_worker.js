const verificationPath = '/google00061d1354abff81.html'
const verificationBody = 'google-site-verification: google00061d1354abff81.html'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === verificationPath) {
      return new Response(verificationBody, {
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'public, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (url.pathname === '/research' || url.pathname === '/research/') {
      url.pathname = '/copies/trionn'
      url.hash = 'case-study'
      return Response.redirect(url.toString(), 308)
    }

    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
      return Response.redirect(url.toString(), 308)
    }

    if (url.pathname !== '/' && !url.pathname.split('/').at(-1)?.includes('.')) {
      const assetUrl = new URL(request.url)
      assetUrl.pathname += '/'
      return env.ASSETS.fetch(new Request(assetUrl, request))
    }

    return env.ASSETS.fetch(request)
  },
}
