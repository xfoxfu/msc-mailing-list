import got, { HTTPError } from "ky";
import jwt from "@tsndr/cloudflare-worker-jwt";
import { auth, jwtSecret, noreplyAddr } from "./consts";

export const sendValidationMail = async (email: string): Promise<void> => {
  const token = await jwt.sign(
    {
      email,
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 1 * (60 * 60), // Expires: Now + 2h
    },
    jwtSecret.secret,
    { algorithm: "HS256" }
  );

  const form = new FormData();
  form.append("from", noreplyAddr);
  form.append("to", email);
  form.append("subject", "【微软俱乐部邮件订阅系统】验证邮件");
  form.append(
    "text",
    `${email},

感谢使用微软俱乐部邮件订阅系统，请点击下面的链接继续：

https://list.noha.dev/manage/${encodeURIComponent(token)}

With regards,
SYSU MSC`
  );
  await got.post("https://api.mailgun.net/v3/list.noha.dev/messages", {
    ...auth,
    body: form,
  });
};

export const userPresents = async (
  list: string,
  email: string
): Promise<boolean> => {
  try {
    const res = (await got(
      `https://api.mailgun.net/v3/lists/${encodeURIComponent(
        list
      )}/members/${encodeURIComponent(email)}`,
      { ...auth }
    ).json()) as any;
    return res?.member?.subscribed ?? false;
  } catch (e) {
    if (e instanceof HTTPError && e.response.status === 404) {
      return false;
    }
    throw e;
  }
};

export const addUser = async (list: string, email: string): Promise<void> => {
  const form = new URLSearchParams();
  form.set("address", email);
  form.set("upsert", "true");

  await got
    .post(
      `https://api.mailgun.net/v3/lists/${encodeURIComponent(list)}/members`,
      {
        ...auth,
        body: form,
      }
    )
    .json();
};

export const removeUser = async (
  list: string,
  email: string
): Promise<void> => {
  try {
    await got
      .delete(
        `https://api.mailgun.net/v3/lists/${encodeURIComponent(
          list
        )}/members/${encodeURIComponent(email)}`,
        { ...auth }
      )
      .json();
  } catch (e) {
    if (e instanceof HTTPError && e.response.status === 404) {
      return;
    }
    throw e;
  }
};
