import { NextRequest } from "next/server";

/**
 * LinkedIn OAuth callback.
 *
 * LinkedIn will not issue a posting token to a server on its own -- a human
 * has to approve once in a browser, and LinkedIn then redirects HERE with a
 * short-lived code. This route swaps that code for the access token and
 * hands it back on screen for the operator to store.
 *
 * The token is deliberately NOT written to disk from here: this endpoint sits
 * on the public site, and a route that quietly persists credentials is a
 * route worth attacking. The exchange needs the client secret, which only the
 * server holds, so a stranger hitting this URL with a junk code gets nothing.
 *
 * LinkedIn access tokens expire after 60 days, so this page gets used again
 * roughly every two months -- hence a real page rather than a throwaway.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const errorDesc = req.nextUrl.searchParams.get("error_description");

  const page = (title: string, body: string, ok = true) =>
    new Response(
      `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
       <div style="font-family:system-ui,-apple-system,Arial,sans-serif;max-width:640px;
                   margin:56px auto;padding:0 20px;line-height:1.6;color:#222">
         <h1 style="color:${ok ? "#0a7d33" : "#b60b0c"};font-size:24px">${title}</h1>
         ${body}
       </div>`,
      { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } }
    );

  if (error) {
    return page(
      "LinkedIn authorisation was declined",
      `<p>LinkedIn reported: <code>${error}</code>${
        errorDesc ? ` &mdash; ${errorDesc}` : ""
      }</p><p>Nothing has changed. You can safely close this tab.</p>`,
      false
    );
  }

  if (!code) {
    return page(
      "Nothing to do here",
      "<p>This page only does something when LinkedIn sends you to it during authorisation.</p>",
      false
    );
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return page(
      "Server is not configured",
      "<p>LinkedIn credentials are missing on the server.</p>",
      false
    );
  }

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://ukcarimports.ie/linkedin-callback",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.access_token) {
    return page(
      "Could not complete authorisation",
      `<p>LinkedIn replied with status ${res.status}.</p>
       <pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow:auto;font-size:13px">${
         JSON.stringify(data, null, 2) || "(no response body)"
       }</pre>`,
      false
    );
  }

  const days = data.expires_in ? Math.round(data.expires_in / 86400) : null;

  return page(
    "LinkedIn connected",
    `<p>Copy the token below and send it to Claude to finish the setup.
        ${days ? `It is valid for about <strong>${days} days</strong>.` : ""}</p>
     <textarea readonly style="width:100%;height:130px;font-family:ui-monospace,monospace;
        font-size:12px;padding:10px;border:2px solid #0a7d33;border-radius:6px">${
       data.access_token
     }</textarea>
     <p style="color:#666;font-size:14px">Treat it like a password &mdash; it can post as you on
        LinkedIn until it expires.</p>`
  );
}
