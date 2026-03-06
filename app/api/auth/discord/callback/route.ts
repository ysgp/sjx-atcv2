import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLE_IDS = ['1471124514170470483', '1443928754631213206'];
const GUILD_ID = process.env.DISCORD_GUILD_ID || ''; // You'll need to add this

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/sjx-admin-panel?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/discord/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to fetch token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Fetch user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user');
    }

    const userData = await userResponse.json();

    // Fetch user's guild member data (including roles)
    // Note: We need to use the bot token to fetch guild member info
    const memberResponse = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!memberResponse.ok) {
      console.error('Failed to fetch member data:', await memberResponse.text());
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/sjx-admin-panel?error=not_member`
      );
    }

    const memberData = await memberResponse.json();
    const userRoles = memberData.roles || [];

    // Check if user has any of the allowed roles
    const hasPermission = userRoles.some((roleId: string) =>
      ALLOWED_ROLE_IDS.includes(roleId)
    );

    if (!hasPermission) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/sjx-admin-panel?error=no_permission`
      );
    }

    // Create session cookie
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/sjx-admin-panel?success=true`
    );

    // Set a secure cookie with user session
    response.cookies.set('discord_session', JSON.stringify({
      userId: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      roles: userRoles,
      timestamp: Date.now(),
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Discord OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/sjx-admin-panel?error=auth_failed`
    );
  }
}
