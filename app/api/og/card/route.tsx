import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username') || 'Player';
  const pfpUrl = searchParams.get('pfp') || '';
  const points = searchParams.get('points') || '0';
  const rank = searchParams.get('rank') || '—';
  const tickets = searchParams.get('tickets') || '0';

  let interFontData: ArrayBuffer | undefined;
  try {
    interFontData = await fetch(`${request.nextUrl.origin}/Inter.ttf`).then((res) => res.arrayBuffer());
  } catch {
    // fallback without custom font
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '40px 60px',
            width: '520px',
          }}
        >
          {pfpUrl ? (
            <img
              src={pfpUrl}
              alt=""
              style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid #0052FF' }}
            />
          ) : (
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              ?
            </div>
          )}
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>@{username}</p>

          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '8px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Rank</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#0052FF', margin: 0 }}>#{rank}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Points</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                {Number(points).toLocaleString()}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Tickets</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e', margin: 0 }}>{tickets}</p>
            </div>
          </div>

          <p
            style={{
              fontSize: '16px',
              color: 'rgba(255,255,255,0.6)',
              marginTop: '16px',
              textAlign: 'center',
            }}
          >
            Stack points. Win passes. Get Based.
          </p>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 400,
      ...(interFontData
        ? {
            fonts: [
              {
                name: 'Inter',
                data: interFontData,
                style: 'normal',
              },
            ],
          }
        : {}),
    }
  );
}
