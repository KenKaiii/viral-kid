import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST: Start impersonating a user
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify the target user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-impersonation
    if (targetUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot impersonate yourself" },
        { status: 400 }
      );
    }

    // Set impersonation cookie (expires in 24 hours)
    const cookieStore = await cookies();
    cookieStore.set(
      "admin_impersonation",
      JSON.stringify({
        userId: targetUser.id,
        userEmail: targetUser.email,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      }
    );

    return NextResponse.json({
      success: true,
      impersonating: {
        userId: targetUser.id,
        email: targetUser.email,
      },
    });
  } catch (error) {
    console.error("Failed to start impersonation:", error);
    return NextResponse.json(
      { error: "Failed to start impersonation" },
      { status: 500 }
    );
  }
}

// DELETE: Stop impersonating
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Remove impersonation cookie
    const cookieStore = await cookies();
    cookieStore.delete("admin_impersonation");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to stop impersonation:", error);
    return NextResponse.json(
      { error: "Failed to stop impersonation" },
      { status: 500 }
    );
  }
}
