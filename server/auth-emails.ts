import { createHash } from "node:crypto";
import { ENV } from "./_core/env";

export type AuthEmailKind = "verify_email" | "email_change" | "password_reset" | "welcome" | "password_changed" | "email_changed" | "security_alert";
type AuthEmailContent = { name?: string | null; actionUrl?: string; detail?: string };
type AuthEmailTemplate = { subject: string; html: string; text: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function renderAuthEmail(kind: AuthEmailKind, content: AuthEmailContent = {}): AuthEmailTemplate {
  const plainName = content.name?.trim().slice(0, 100) || "Olá";
  const name = escapeHtml(plainName);
  const appUrl = ENV.appPublicUrl.replace(/\/$/, "");
  const fallbackPaths: Partial<Record<AuthEmailKind, string>> = { welcome: "/dashboard", password_changed: "/login", email_changed: "/login", security_alert: "/perfil" };
  const rawActionUrl = content.actionUrl ?? (fallbackPaths[kind] && appUrl ? `${appUrl}${fallbackPaths[kind]}` : undefined);
  const actionUrl = rawActionUrl ? escapeHtml(rawActionUrl) : "";
  const actionText: Partial<Record<AuthEmailKind, string>> = {
    verify_email: "Confirmar meu e-mail", email_change: "Confirmar novo e-mail", password_reset: "Redefinir minha senha", welcome: "Acessar minha conta", password_changed: "Acessar minha conta", email_changed: "Acessar minha conta", security_alert: "Revisar minha conta",
  };
  const titles: Record<AuthEmailKind, string> = {
    verify_email: "Confirme seu e-mail", email_change: "Confirme seu novo e-mail", password_reset: "Redefina sua senha", welcome: "Boas-vindas ao Ritmo Pro Man", password_changed: "Sua senha foi alterada", email_changed: "Seu e-mail foi alterado", security_alert: "Alerta de segurança da conta",
  };
  const descriptions: Record<AuthEmailKind, string> = {
    verify_email: "Confirme este endereço para concluir a criação da sua conta. O link expira em 30 minutos e pode ser usado uma única vez.",
    email_change: "Confirme este endereço para concluir a alteração do e-mail da sua conta. O link expira em 30 minutos e pode ser usado uma única vez.",
    password_reset: "Recebemos uma solicitação para redefinir a senha da sua conta. O link expira em 20 minutos e pode ser usado uma única vez. Se não foi você, ignore esta mensagem.",
    welcome: "Sua conta está pronta. Acompanhe seus treinos e sua evolução no Ritmo Pro Man.",
    password_changed: "A senha da sua conta foi alterada. Se você não fez essa alteração, proteja sua conta imediatamente.",
    email_changed: "O endereço de e-mail associado à sua conta foi alterado. Se você não reconhece essa mudança, entre em contato com o suporte.",
    security_alert: content.detail?.trim() || "Detectamos uma alteração de segurança na sua conta. Se você não reconhece esta atividade, revise sua conta e entre em contato com o suporte.",
  };
  const subject = titles[kind];
  const description = descriptions[kind];
  const button = actionUrl && actionText[kind] ? `<a href="${actionUrl}" style="display:inline-block;background:#064e3b;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">${actionText[kind]}</a>` : "";
  const buttonText = actionUrl && actionText[kind] ? `${actionText[kind]}: ${rawActionUrl}` : "";
  const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${subject}</title></head><body style="margin:0;background:#f3f6f3;font-family:Arial,Helvetica,sans-serif;color:#17211b"><div style="max-width:600px;margin:0 auto;padding:28px 16px"><div style="background:#064e3b;color:#fff;padding:22px 26px;border-radius:16px 16px 0 0;font-size:20px;font-weight:700">Ritmo Pro Man</div><main style="background:#fff;padding:30px 26px;border:1px solid #e2e8e4;border-top:0;border-radius:0 0 16px 16px"><p style="margin:0 0 8px;color:#52615a">${name},</p><h1 style="margin:0 0 16px;font-size:25px;line-height:1.25">${subject}</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#435149">${escapeHtml(description)}</p>${button ? `<div style="margin:26px 0">${button}</div>` : ""}<p style="font-size:13px;line-height:1.6;color:#68756e">${button ? `Se o botão não funcionar, copie este endereço:<br><a href="${actionUrl}" style="color:#065f46;word-break:break-all">${actionUrl}</a><br><br>` : ""}Nunca compartilhe links de segurança. Nossa equipe nunca pedirá sua senha por e-mail.</p><hr style="border:0;border-top:1px solid #e5e9e6;margin:26px 0"><p style="font-size:12px;line-height:1.6;color:#78837d;margin:0">Ritmo Pro Man · Movimento com consistência<br><a href="${escapeHtml(ENV.appPublicUrl.replace(/\/$/, ""))}/termos" style="color:#52615a">Termos de Uso</a> · <a href="${escapeHtml(ENV.appPublicUrl.replace(/\/$/, ""))}/privacidade" style="color:#52615a">Política de Privacidade</a></p></main></div></body></html>`;
  const text = `Ritmo Pro Man\n\n${plainName},\n\n${subject}\n${description}${buttonText ? `\n\n${buttonText}` : ""}\n\nNunca compartilhe links de segurança. Nossa equipe nunca pedirá sua senha por e-mail.\n\nTermos de Uso: ${appUrl}/termos\nPolítica de Privacidade: ${appUrl}/privacidade`;
  return { subject, html, text };
}

export async function sendAuthEmail(kind: AuthEmailKind, to: string, content: AuthEmailContent = {}, dedupeKey?: string): Promise<boolean> {
  if (!ENV.resendApiKey || !ENV.emailFrom || !ENV.appPublicUrl) return false;
  try {
    const template = renderAuthEmail(kind, content);
    const idempotencyKey = createHash("sha256").update(`${kind}\0${to.toLowerCase()}\0${dedupeKey ?? template.subject}`).digest("hex");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${ENV.resendApiKey}`, "content-type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from: ENV.emailFrom, to: [to], subject: template.subject, html: template.html, text: template.text }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) console.warn(`[AuthEmail] Delivery failed (${response.status})`);
    return response.ok;
  } catch {
    console.warn("[AuthEmail] Delivery temporarily unavailable");
    return false;
  }
}
