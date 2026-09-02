import nodemailer from "nodemailer";
import { logger } from "./logger";

function createTransport() {
  const user = process.env["EMAIL_USER"];
  const pass = process.env["EMAIL_PASS"];
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function send(opts: { to: string; subject: string; html: string }) {
  const transporter = createTransport();
  if (!transporter) {
    logger.warn("Email not configured (EMAIL_USER/EMAIL_PASS missing) — skipping");
    return;
  }
  try {
    await transporter.sendMail({
      from: `"SupportDesk" <${process.env["EMAIL_USER"]}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send email");
  }
}

function ticketUrl(ticketId: string, role: "admin" | "user") {
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? "";
  if (role === "admin") return `https://${domain}/(admin)/ticket/${encodeURIComponent(ticketId)}`;
  return `https://${domain}/user-ticket/${encodeURIComponent(ticketId)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1e3a5f;color:#fff;border-radius:8px;text-decoration:none;font-family:sans-serif;font-size:14px;">${label}</a>`;
}

function wrap(body: string) {
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:20px 24px;">
      <span style="color:#fff;font-size:18px;font-weight:700;">SupportDesk</span>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      ${body}
    </div>
  </div>`;
}

export async function sendAdminReplyEmail(opts: {
  userEmail: string;
  ticketId: string;
  productName: string;
  replyMessage: string;
}) {
  const url = ticketUrl(opts.ticketId, "user");
  const productName = escapeHtml(opts.productName);
  const replyMessage = escapeHtml(opts.replyMessage);
  await send({
    to: opts.userEmail,
    subject: `Admin replied to your ticket: ${opts.productName.replace(/[\r\n]/g, " ")}`,
    html: wrap(`
      <p style="font-size:15px;margin:0 0 12px;">You have a new reply from our support team on your ticket <strong>${productName}</strong>.</p>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${replyMessage}</div>
      ${btn(url, "View Ticket")}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Ticket ID: #${opts.ticketId.slice(-8)}</p>
    `),
  });
}

export async function sendStatusUpdateEmail(opts: {
  userEmail: string;
  ticketId: string;
  productName: string;
  newStatus: string;
}) {
  const label = opts.newStatus === "in-progress" ? "In Progress" : opts.newStatus.charAt(0).toUpperCase() + opts.newStatus.slice(1);
  const url = ticketUrl(opts.ticketId, "user");
  const productName = escapeHtml(opts.productName);
  await send({
    to: opts.userEmail,
    subject: `Ticket status updated: ${opts.productName.replace(/[\r\n]/g, " ")}`,
    html: wrap(`
      <p style="font-size:15px;margin:0 0 12px;">Your ticket <strong>${productName}</strong> has been updated.</p>
      <p style="font-size:14px;margin:0;">New status: <strong style="color:#1e3a5f;">${label}</strong></p>
      ${btn(url, "View Ticket")}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Ticket ID: #${opts.ticketId.slice(-8)}</p>
    `),
  });
}

export async function sendTicketReceivedEmail(opts: {
  userEmail: string;
  ticketId: string;
  productName: string;
}) {
  const url = ticketUrl(opts.ticketId, "user");
  const productName = escapeHtml(opts.productName);
  await send({
    to: opts.userEmail,
    subject: `We received your support ticket: ${opts.productName.replace(/[\r\n]/g, " ")}`,
    html: wrap(`
      <p style="font-size:15px;margin:0 0 12px;">Thanks for contacting SupportDesk. We received your ticket for <strong>${productName}</strong>.</p>
      <p style="font-size:14px;color:#374151;margin:0;">Our support team will review it and update you in the app and by email when there is activity.</p>
      ${btn(url, "View Ticket")}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Ticket ID: #${opts.ticketId.slice(-8)}</p>
    `),
  });
}

export async function sendUserReplyEmail(opts: {
  adminEmail: string;
  ticketId: string;
  productName: string;
  userName: string;
  replyMessage: string;
}) {
  const url = ticketUrl(opts.ticketId, "admin");
  const productName = escapeHtml(opts.productName);
  const userName = escapeHtml(opts.userName);
  const replyMessage = escapeHtml(opts.replyMessage);
  await send({
    to: opts.adminEmail,
    subject: `User replied to ticket: ${opts.productName.replace(/[\r\n]/g, " ")}`,
    html: wrap(`
      <p style="font-size:15px;margin:0 0 12px;"><strong>${userName}</strong> replied to ticket <strong>${productName}</strong>.</p>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${replyMessage}</div>
      ${btn(url, "View Ticket")}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Ticket ID: #${opts.ticketId.slice(-8)}</p>
    `),
  });
}

export async function sendPasswordResetEmail(opts: {
  userEmail: string;
  resetToken: string;
}) {
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? "";
  const url = `https://${domain}/reset-password?token=${encodeURIComponent(opts.resetToken)}`;
  await send({
    to: opts.userEmail,
    subject: "Reset your SupportDesk password",
    html: wrap(`
      <p style="font-size:15px;margin:0 0 12px;">We received a request to reset the password for your SupportDesk account.</p>
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
      ${btn(url, "Reset Password")}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">If the button does not work, copy and paste this URL into your browser:<br/>${url}</p>
    `),
  });
}
