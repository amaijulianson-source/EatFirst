/* global fetch, Headers, Response */
export function browserFetch(page) {
  return async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const headers = Object.fromEntries(new Headers(init.headers));
    const response = await page.evaluate(
      async ({ url, method, headers, body }) => {
        const r = await fetch(url, { method, headers, body });
        return {
          status: r.status,
          statusText: r.statusText,
          headers: [...r.headers.entries()],
          body: await r.text(),
        };
      },
      {
        url,
        method: init.method ?? "GET",
        headers,
        body: init.body ?? undefined,
      },
    );
    return new Response(
      [204, 205, 304].includes(response.status) ? null : response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      },
    );
  };
}
