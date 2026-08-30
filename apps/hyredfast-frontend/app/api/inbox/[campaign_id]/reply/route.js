import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsCampaign, notFound } from "@/lib/authz";
import { decryptSecret } from "@/lib/crypto";

export async function POST(request, props) {
  const params = await props.params;
  const campaignId = params.campaign_id;
  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsCampaign(auth.userId, campaignId)))
    return notFound("Campaign");

  try {
    const { campaignLeadId, text, messageId } = await request.json();

    if (!campaignLeadId || !text) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    const campaignLead = await prisma.campaignLead.findUnique({
      where: { id: campaignLeadId },
      include: { cred: true },
    });

    if (!campaignLead) {
      return NextResponse.json(
        { message: "Campaign email not found" },
        { status: 404 },
      );
    }

    const recipientEmail = campaignLead.email;
    const recipientName = campaignLead.name;

    if (!campaignLead.cred) {
      return NextResponse.json(
        { message: "No email credentials found for this contact" },
        { status: 404 },
      );
    }

    const emailCredential = campaignLead.cred;

    const transporter = nodemailer.createTransport({
      host: emailCredential.host,
      port: emailCredential.port,
      secure: emailCredential.secure,
      auth: {
        user: emailCredential.username,
        pass: decryptSecret(emailCredential.password),
      },
    });

    await transporter.sendMail({
      from: emailCredential.username,
      to: recipientEmail,
      subject: `Re: ${recipientName || "Your message"}`,
      text: text,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      `[API] Error sending reply for campaign ${campaignId}:`,
      error,
    );
    return NextResponse.json(
      { message: error?.message || "Failed to send reply" },
      { status: 500 },
    );
  }
}
