import { tryAuth } from "@/lib/auth";
import axios from "axios";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

export async function POST(request) {
  // Authenticate before anything else: below, the server opens outbound SMTP
  // and IMAP connections to hosts named in the request body. Leaving that
  // ahead of the auth check hands any anonymous caller a way to make this
  // server connect wherever they like.
  const { auth: user, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  const {
    username,
    password,
    port,
    secure,
    host,
    imap_host,
    imapEmail,
    imapPassword,
  } = await request.json();

  try {
    await sendTestEmail({ email: username, password, port, host, secure });
    await testImapEmail({
      username: imapEmail,
      password: imapPassword,
      host: imap_host,
      port: 993,
      secure: true,
    });
  } catch (error) {
    console.error("[API] Invalid email credentials:", error);
    return NextResponse.json(
      { message: "Invalid email credential" },
      { status: 400 },
    );
  }

  try {
    const record = await prisma.emailCredential.create({
      data: {
        username,
        // Encrypted at rest: these are live mailbox passwords, and a Postgres
        // dump or a stray SELECT would otherwise hand over every user's inbox.
        password: encryptSecret(password),
        userId: user.userId,
        host: host || "smtp.gmail.com",
        port: port || 465,
        secure: secure || true,
        imapHost: imap_host,
        imapEmail,
        imapPassword: encryptSecret(imapPassword),
        // Under Gmail's 500/day personal cap with room to spare. The sender
        // paces itself, so this is the ceiling, not a target.
        dailyLimit: 200,
      },
    });

    // Echo the row back without the secrets. The client only needs the id to
    // revalidate its list, and /api/google_apps already refuses to select these.
    const { password: _p, imapPassword: _i, ...safeRecord } = record;

    return NextResponse.json(safeRecord);
  } catch (error) {
    console.error("[API] Error creating email credentials:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

async function sendTestEmail({ host, port, secure, email, password }) {
  console.log("[API] Sending test email to:", email);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: email,
      pass: password,
    },
  });

  const mailOptions = {
    from: email,
    to: email,
    subject: "Test Email",
    text: `Hello There,

You've just added a new email address to your Denshees account, and we wanted to send this test email to confirm that your SMTP connection is all set up and working perfectly.

If you have any questions or run into any issues, feel free to reach out to us at arpitabhyankar99823@gmail.com. We're always here to help!

Thanks for choosing Denshees. We look forward to supporting your email marketing journey!

Best regards,
Arpit Abhyankar (Co-Owner, Denshees)`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("[API] Test email sent:", info.messageId);
  } catch (error) {
    console.error("[API] Error sending test email:", error);
    throw error;
  }
}

async function testImapEmail({ username, password, host, port, secure }) {
  console.log("[API] Testing IMAP connection");

  const backendUrl = process.env.BACKEND_URL || "http://localhost:8100";

  const res = await axios.post(`${backendUrl}/email/test-imap`, {
    host,
    port,
    secure,
    username,
    password,
  });

  if (res.status !== 200) {
    throw new Error(res.data?.message || "IMAP test failed");
  }

  console.log("[API] IMAP connection test successful");
}
