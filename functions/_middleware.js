// Runs in front of every request on Cloudflare Pages.
// Until the site is announced, the custom domain shows only the coming-soon page;
// the full site stays visible on the *.pages.dev address.
const PLACEHOLDER = true;

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.hostname === "kirillskovpen.com") {
    url.hostname = "www.kirillskovpen.com";
    return Response.redirect(url.toString(), 301);
  }
  if (PLACEHOLDER && url.hostname === "www.kirillskovpen.com") {
    const res = await ctx.env.ASSETS.fetch(new URL("/coming-soon/", url));
    return new Response(res.body, { status: 200, headers: res.headers });
  }
  return ctx.next();
}
