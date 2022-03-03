import { Router, Route, Request } from "itty-router";
import { addUser, removeUser, sendValidationMail, userPresents } from "./api";
import { auth, jwtSecret, lists, noreplyAddr } from "./consts";
import jwt from "@tsndr/cloudflare-worker-jwt";

const errorHandler = (error: Error) =>
  new Response((error.message ?? "Server Error") + error.stack, {
    status: (error as any)?.status ?? 500,
  });

const router = Router();
router.get("/", (req) => {
  return new Response(
    `<!DOCTYPE html>
<head></head>
<body>
<h1>微软俱乐部邮件订阅系统</h1>
<p>输入邮件地址提交后，请按照邮件提示操作。邮件发件人为 ${noreplyAddr}</p>
<form method="POST">
  <label for="email">邮箱:</label>
  <input type="text" id="email" name="email">
  <input type="submit" value="提交">
</form> 
</body>`,
    { headers: { "Content-Type": "text/html;charset=utf8" } }
  );
});
router.post("/", async (req) => {
  const body = new URLSearchParams((await req.text?.()) ?? "");
  const email = body.get("email") ?? "";
  await sendValidationMail(email);
  return new Response(
    `<!DOCTYPE html>
<head></head>
<body>
<p>请按照邮件提示操作。邮件发件人为 ${noreplyAddr
      .replace("<", "&lt;")
      .replace(">", "&gt;")}</p>
</body>`,
    { headers: { "Content-Type": "text/html;charset=utf8" } }
  );
});
router.get("/manage/:token", async (req) => {
  const token = req.params?.token ?? "";
  const isValid = await jwt.verify(token, jwtSecret.secret);
  if (!isValid) throw new Error("验证信息无效，请尝试重新发送邮件");

  const payload = (jwt.decode(token) ?? {}) as any;
  const toggles = await Promise.all(
    lists.map(async (l) => ({
      addr: l.addr,
      name: l.name,
      toggle: await userPresents(l.addr, payload.email),
    }))
  );

  return new Response(
    `<!DOCTYPE html>
<head></head>
<body>
<h1>微软俱乐部邮件订阅系统</h1>
<h2>${payload.email}</h2>
<form method="POST">
${toggles
  .map(
    (l) => `<label for="${l.addr}">${l.name} (${l.addr})</label>
  <input type="checkbox" id="${l.addr}" name="${l.addr}" ${
      l.toggle ? "checked" : ""
    }>`
  )
  .join("<br>")}<br>
  <input type="submit" value="提交">
</form>
<p>若需要发布活动，可以直接在日历中邀请对应的邮件地址，所有关注该邮件地址的人将收到提醒。</p>
</body>`,
    { headers: { "Content-Type": "text/html;charset=utf8" } }
  );
});
router.post("/manage/:token", async (req) => {
  const token = req.params?.token ?? "";
  const isValid = await jwt.verify(token, jwtSecret.secret);
  if (!isValid) throw new Error("验证信息无效，请尝试重新发送邮件");

  const payload = (jwt.decode(token) ?? {}) as any;
  const email = payload.email;

  const body = new URLSearchParams((await req.text?.()) ?? "");
  const toggles = lists.map((l) => ({
    addr: l.addr,
    toggle: body.get(l.addr) === "on",
  }));
  for (const item of toggles) {
    if (item.toggle === true) {
      await addUser(item.addr, email);
    } else {
      await removeUser(item.addr, email);
    }
  }

  return new Response(
    `<!DOCTYPE html>
<head></head>
<body>
<p>修改成功。</p>
</body>`,
    { headers: { "Content-Type": "text/html;charset=utf8" } }
  );
});

router.all("*", () => new Response("Not Found.", { status: 404 }));

export default {
  async fetch(req: Request, env: Env) {
    jwtSecret.secret = env.JWT_SECRET;
    auth.headers["Authorization"] = env.MAILGUN_TOKEN;
    return router.handle(req).catch(errorHandler);
  },
};
