import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/invites - List all invites
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invites = await db.invite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: {
          select: {
            email: true,
          },
        },
      },
    });

    // Check which invites have been used (user signed up with that email)
    const inviteEmails = invites.map((i) => i.email);
    const usersWithEmails = await db.user.findMany({
      where: { email: { in: inviteEmails } },
      select: { email: true },
    });
    const signedUpEmails = new Set(usersWithEmails.map((u) => u.email));

    const formattedInvites = invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      usedAt: invite.usedAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      invitedByEmail: invite.invitedBy.email,
      status: invite.usedAt
        ? "used"
        : signedUpEmails.has(invite.email)
          ? "used"
          : new Date() > invite.expiresAt
            ? "expired"
            : "pending",
    }));

    return NextResponse.json(formattedInvites);
  } catch (error) {
    console.error("Failed to fetch invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

// POST /api/admin/invites - Create a new invite
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Check if invite already exists for this email
    const existingInvite = await db.invite.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingInvite) {
      // Update existing invite with new token and expiry
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const updatedInvite = await db.invite.update({
        where: { id: existingInvite.id },
        data: {
          token,
          expiresAt,
          usedAt: null,
        },
      });

      return NextResponse.json({
        id: updatedInvite.id,
        email: updatedInvite.email,
        token: updatedInvite.token,
        expiresAt: updatedInvite.expiresAt.toISOString(),
        createdAt: updatedInvite.createdAt.toISOString(),
        status: "pending",
        renewed: true,
      });
    }

    // Create new invite
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await db.invite.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt,
        invitedById: session.user.id,
      },
    });

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      status: "pending",
    });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
